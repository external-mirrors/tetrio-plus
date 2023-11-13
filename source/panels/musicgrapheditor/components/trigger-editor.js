import {
  events,
  eventValueExtendedModes,
  eventHasTarget
} from '../events.js';
import ExpressionEditor from './expression-editor.js';
import * as clipboard from '../clipboard.js';
import /* non-ES6 */ '../../../shared/expval.js';
const html = arg => arg.join(''); // NOOP, for editor integration.

export default {
  template: html`
    <div>
      <div>
        <b>Event</b>
        <select v-model="trigger.event" style="font-size: 0.825rem" @change="$emit('change')">
          <option :value="custom ? trigger.event : 'CUSTOM'">CUSTOM</option>
          <option
            v-for="evt of events"
            :value="evt"
            :disabled="trigger.mode == 'random' && evt == 'random-target'"
          >{{evt}}</option>
        </select>
        <button @click="removeTrigger(node, trigger)" class="icon-button">
          ❌
        </button>
        <button @click="copyTrigger(trigger)">Copy</button>
        <button @click="shiftTrigger(node, trigger, -1)" class="icon-button">
          🔼
        </button>
        <button @click="shiftTrigger(node, trigger, 1)" class="icon-button">
          🔽
        </button>
      </div>

      <div v-if="custom">
        <b>Name</b>
        <input type="text" @change="$emit('change')" v-model="trigger.event" />
      </div>

      <div v-if="['repeating-time-passed', 'time-passed'].includes(trigger.event)">
        <b>Seconds</b>
        <input
          type="number"
          @change="$emit('change')"
          v-model.number="trigger.timePassedDuration"
        />
      </div>

      <div v-if="showExpressionEditor">
        <expression-editor
          v-model="trigger.predicateExpression"
          @change="$emit('change')"
          :optional="true"
          @focus="predicateFocused = true"
          @blur="predicateFocused = false"
        >{{ eventValueExtendedModes[trigger.event] || "Predicate" }}</expression-editor>
      </div>

      <div style="white-space: nowrap;">
        <b>Mode</b>
        <select v-model="trigger.mode" @change="$emit('change')">
          <option value="fork">Create new node (fork)</option>
          <option value="goto">Go to node (goto)</option>
          <option value="kill">Stop executing (kill)</option>
          <option value="create">Create this node (create)</option>
          <option value="dispatch">
            Dispatch a global custom event (dispatch)
          </option>
          <option value="random" :disabled="trigger.event == 'random-target'">
            Run a random-target trigger (random)
          </option>
          <option value="set">
            Set a variable (set)
          </option>
        </select>
        <button
          @click="trigger.predicateExpression = '$ >= 0'"
          :disabled="showExpressionEditor"
          style="padding: 1px 2px; font-size: 0.8rem"
        >Add predicate</button>
      </div>

      <template v-if="trigger.mode == 'dispatch'">
        <div>
          <b>Name</b>
          <input
            type="text"
            @change="$emit('change')"
            v-model="trigger.dispatchEvent"
          />
        </div>
        <expression-editor
          v-model="trigger.dispatchExpression"
          @change="$emit('change')"
          :optional="true"
        >Value</expression-editor>
      </template>

      <template v-if="trigger.mode == 'set'">
        <div>
          <b :style="variableNameError ? { color: 'red' } : {}">Variable</b>
          <input
            type="text"
            @change="$emit('change')"
            v-model="trigger.setVariable"
          />
        </div>
        <div v-if="variableNameError" style="color: red">
          {{variableNameError}}
        </div>
        <expression-editor
          v-model="trigger.setExpression"
        >Expression</expression-editor>
      </template>

      <div v-if="hasTarget(trigger)">
        <b>Target</b>
        <select v-model="trigger.target" @change="$emit('change')">
          <option :value="node.id" v-for="node of nodes">
            {{ node.name }}
          </option>
        </select>
        <a href="#" @click="focus(trigger.target)">jump</a>
      </div>

      <template v-if="allowsPreserveLocation(trigger)">
        <div class="form-control">
          <input
            type="checkbox"
            @change="$emit('change')"
            v-model="trigger.preserveLocation"
          />
          Preserve location after jumping
        </div>
        <div class="form-control" v-if="trigger.preserveLocation">
          Length ratio <input
            type="number"
            v-model.number="trigger.locationMultiplier"
            @change="$emit('change')"
            step="0.001"
            min="0.001"
          />
          <span class="form-control-value-display">
            (target / source)
          </span>
        </div>
      </template>

      <template v-if="allowsCrossfade(trigger)">
        <div class="form-control">
          <input
            type="checkbox"
            v-model="trigger.crossfade"
            @change="$emit('change')"
          />
          Crossfade
        </div>
        <div class="form-control" v-if="trigger.crossfade">
          Crossfade duration <input
            type="number"
            v-model.number="trigger.crossfadeDuration"
            @change="$emit('change')"
            step="0.001"
            min="0"
          />s
        </div>
      </template>
    </div>
  `,
  props: ['nodes', 'node', 'trigger'],
  components: { ExpressionEditor },
  data: () => {
    return {
      events,
      eventValueExtendedModes,
      predicateFocused: false,
      clipboard: clipboard.clipboard
    }
  },
  computed: {
    eventSet() {
      return new Set(this.events);
    },
    showExpressionEditor() {
      return (
        this.eventValueExtendedModes[this.trigger.event] ||
        this.trigger.predicateExpression ||
        this.predicateFocused
      );
    },
    custom() {
      return !this.eventSet.has(this.trigger.event);
    },
    variableNameError() {
      try {
        ExpVal.substitute(this.trigger.setVariable, {});
        return null;
      } catch(ex) {
        return ex.toString();
      }
    },
    ...clipboard.computed
  },
  watch: {
    'trigger.setVariable'(newVal) {
      let sanitized = newVal.replace(/^[^$#A-Za-z_]|[^$#A-Za-z0-9_{}]/g, '_');
      if (sanitized != newVal)
        this.trigger.setVariable = sanitized;
    }
  },
  methods: {
    allowsCrossfade(trigger) {
      return (
        trigger.mode == 'goto' &&
        this.hasTarget(trigger) &&
        this.targetHasAudio(trigger)
      );
    },
    allowsPreserveLocation(trigger) {
      return (
        this.hasTarget(trigger) &&
        this.targetHasAudio(trigger)
      );
    },
    focus(node) {
      this.$emit('focus', node);
    },
    targetHasAudio(trigger) {
      let node = this.nodes.filter(node => node.id == trigger.target)[0];
      if (!node) return false;
      return !!node.audio;
    },
    hasTarget(trigger) {
      return eventHasTarget[trigger.mode];
    },
    shiftTrigger(node, trigger, dir) {
      let index = node.triggers.indexOf(trigger);
      node.triggers.splice(index, 1);
      node.triggers.splice(index+dir, 0, trigger);
      this.$emit('change');
    },
    removeTrigger(node, trigger) {
      node.triggers.splice(node.triggers.indexOf(trigger), 1);
      this.$emit('change');
    },
    copyTrigger(trigger) {
      this.copiedTrigger = trigger;
    }
  }
}
