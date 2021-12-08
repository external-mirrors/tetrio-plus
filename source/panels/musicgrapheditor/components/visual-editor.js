import {
  events,
  eventValueExtendedModes,
  eventHasTarget
} from '../events.js';
import {clipboard} from '../clipboard.js';
const html = arg => arg.join(''); // NOOP, for editor integration.

export default {
  template: html`
    <div ref="editor" class="visual-editor" :style="editorStyle" tabindex="0">
      <template v-for="node of nodes">
        <div
          class="node"
          :class="{ selected: isSelected(node) }"
          :node-id="node.id"
          :style="{
            '--x': (node.x + camera.x) + 'px',
            '--y': (node.y + camera.y) + 'px'
          }"
        >{{node.name}}</div>

        <template v-for="link of getLinks(node, node.triggers)">
          <div
            class="node-anchor origin"
            :node-id="node.id"
            :trigger-index="link.i"
            :style="{
              '--x': (link.x1 + camera.x) + 'px',
              '--y': (link.y1 + camera.y) + 'px'
            }"
          ></div>
          <div
            v-if="link.targetType == 'target'"
            class="node-anchor target"
            :node-id="node.id"
            :trigger-index="link.i"
            :style="{
              '--x': (link.x2 + camera.x) + 'px',
              '--y': (link.y2 + camera.y) + 'px'
            }"
          ></div>
        </template>
      </template>

      <svg style="width: 100%; height: 100%;">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="12" markerHeight="12"
              orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z"/>
          </marker>
          <marker id="arrow-outline" viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="12" markerHeight="12"
              orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" stroke="black" fill="none"/>
          </marker>
          <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="12" markerHeight="12">
            <circle cx="5" cy="5" r="5" fill="black" />
          </marker>
          <marker id="x" viewBox="0 0 10 10" refX="5" refY="5"
              markerWidth="12" markerHeight="12">
            <path d="
              M 5 5 L 0 0
              M 5 5 L 10 0
              M 5 5 L 0 10
              M 5 5 L 10 10
            " stroke="red" stroke-width="2px" />
          </marker>
          <marker id="?" viewBox="0 0 10 12" refX="5" refY="5"
              markerWidth="24" markerHeight="24">
            <text
              stroke="black"
              dominant-baseline="hanging"
              font-family="monospace"
              font-size="8px"
            >🎲</text>
          </marker>
          <marker id="global" viewBox="0 0 10 12" refX="5" refY="5"
              markerWidth="24" markerHeight="24">
            <text
              stroke="black"
              dominant-baseline="hanging"
              font-family="monospace"
              font-size="8px"
            >🌐</text>
          </marker>
          <marker id="=" viewBox="0 0 5 3" refX="2.6" refY="1.6"
              markerWidth="24" markerHeight="24">
            <path d="M 0 0 L 5 0 L 5 3 L 0 3 L 0 0" fill="black" />
            <path d="M 1 1 L 4 1 M 1 2 L 4 2" stroke="lime" stroke-width="0.5px" />
          </marker>
        </defs>

        <g :transform="svgTransform">
          <template v-for="node of nodes">
            <template v-for="link of getLinks(node, node.triggers)">
              <line
                :x1="link.x1" :y1="link.y1" :x2="link.x2" :y2="link.y2"
                stroke="black"
                :marker-start="link.startCap ? \`url(#\${link.startCap})\` : null"
                :marker-end="link.endCap ? \`url(#\${link.endCap})\` : null"
                :stroke-dasharray="link.trigger.mode == 'fork' ? '8 4' : null"
              />
              <text
                :x="link.textX"
                :y="link.textY"
                :node-id="node.id"
                :trigger-index="link.i"
                :text-anchor="link.textAnchor"
                :dominant-baseline="link.textBaseline"
              >​{{ link.label }}</text>
            </template>
          </template>
        </g>

        <rect
          v-if="selectRect"
          :x="Math.min(selectRect.x1, selectRect.x2) - this.editorRect().left"
          :y="Math.min(selectRect.y1, selectRect.y2) - this.editorRect().top"
          :width="Math.abs(selectRect.x2 - selectRect.x1)"
          :height="Math.abs(selectRect.y2 - selectRect.y1)"
          fill="none"
          stroke="red"
          stroke-width="2"
        />
      </svg>
    </div>
  `,
  props: ['nodes'],
  data: () => ({
    camera: { x: 0, y: 0 },
    selectRect: null
  }),
  computed: {
    editorStyle() {
      return {
        '--bg-x': this.camera.x + 'px',
        '--bg-y': this.camera.y + 'px'
      }
    },
    svgTransform() {
      return `translate(${this.camera.x}, ${this.camera.y})`
    }
  },
  methods: {
    editorRect() {
      return this.$refs.editor.getBoundingClientRect();
    },
    isSelected(node) {
      return clipboard.selected.indexOf(node) != -1
    },
    round(val, step) {
      return Math.round(val / step) * step;
    },
    getNodeById(id) {
      return this.nodes.filter(node => node.id == id)[0];
    },
    getNodeFromElem(elem) {
      if (!elem) return null;
      let nodeId = elem.getAttribute('node-id');
      return this.getNodeById(nodeId);
    },
    getLinks(node, triggers) {
      return triggers.map((trigger, i) => {
        let target = this.getNodeById(trigger.target);
        if (!target) target = { id: -1, x: node.x, y: node.y };

        let label = trigger.event;
        if (events.indexOf(trigger.event) == -1)
          label = '🌐' + label;
        if (eventValueExtendedModes[trigger.event])
          label += ` ${trigger.predicateExpression}`;
        label += ' ' + trigger.mode;
        if (trigger.mode == 'dispatch') {
          label += ' ' + trigger.dispatchEvent;
          if (trigger.dispatchExpression.trim().length > 0)
            label += ` (${trigger.dispatchExpression})`;
        }
        if (trigger.mode == 'set')
          label += ` ${trigger.setVariable} = ${trigger.setExpression}`;

        let targetType = 'target';
        if (trigger.target == node.id)
          targetType = 'self-target';
        if (!eventHasTarget[trigger.mode])
          targetType = 'no-target';

        let x1 = node.x + trigger.anchor.origin.x;
        let y1 = node.y + trigger.anchor.origin.y;
        let x2 = target.x + trigger.anchor.target.x;
        let y2 = target.y + trigger.anchor.target.y;

        let startCap = null;
        let endCap = 'arrow';

        // average relative position of anchors to their parents
        let relX = ((x1 - node.x) + (x2 - target.x))/2 * 1/200;
        let relY = ((y1 - node.y) + (y2 - target.y))/2 * 1/60;

        let textAnchor = 'start';
        if (relX < 2/3) textAnchor = 'middle';
        if (relX < 1/3) textAnchor = 'end';

        let textBaseline = relY < 0.5 ? 'baseline' : 'hanging';
        if (targetType != 'target')
          textBaseline = 'middle';

        // calculated later if not overriden.
        let translateX = null;
        let translateY = null;
        let textX = null;
        let textY = null;

        // Add offset from side to determine position of non-target node ends
        if (targetType != 'target') {
          let side = null;
          if (trigger.anchor.origin.y <= 10) side = 'top';
          if (trigger.anchor.origin.y >= 50) side = 'bottom';
          if (trigger.anchor.origin.x <= 10) side = 'left';
          if (trigger.anchor.origin.x >= 190) side = 'right';
          switch (side) {
            default:
            case 'top':
              x2 = x1;
              y2 = y1 - 50;
              relX = (x2 - node.x)/200;
              relY = ((y1 - node.y) + (y2 - target.y))/2 * 1/60;
              textY = y2 - 20;
              break;

            case 'bottom':
              x2 = x1;
              y2 = y1 + 50;
              relX = (x2 - node.x)/200;
              relY = ((y1 - node.y) + (y2 - target.y))/2 * 1/60;
              textY = y2 + 20;
              break;

            case 'left':
              y2 = y1;
              x2 = x1 - 50;
              relX = ((x1 - node.x) + (x2 - target.x))/2 * 1/200;
              relY = (y2 - node.y)/60;
              textX = x2 - 15;
              translateY = 0;
              break;

            case 'right':
              y2 = y1;
              x2 = x1 + 50;
              relX = ((x1 - node.x) + (x2 - target.x))/2 * 1/200;
              relY = (y2 - node.y)/60;
              textX = x2 + 15;
              translateY = 0;
              break;
          }
          startCap = 'arrow';
          endCap = 'dot';
        }

        if (translateX == null)
          translateX = relX < 1/3 ? -10 : relX > 2/3 ? 10 : 0;

        if (translateY == null)
          translateY = relY < 0.5 ? -5 : 5;

        if (textX === null)
          textX = (x2 + x1)/2 + translateX;

        if (textY === null)
          textY = (y2 + y1)/2 + translateY;

        if (trigger.mode == 'fork') {
          if (startCap == 'arrow') startCap = 'arrow-outline';
          if (endCap == 'arrow') endCap = 'arrow-outline';
        }

        if (trigger.mode == 'random') {
          startCap = null;
          endCap = '?';
        }

        if (trigger.mode == 'kill') {
          startCap = null;
          endCap = 'x';
        }

        if (trigger.mode == 'dispatch') {
          startCap = null;
          endCap = 'global';
        }

        if (trigger.mode == 'set') {
          startCap = null;
          endCap = '=';
        }

        return {
          i, trigger, targetType,
          label, startCap, endCap,
          x1, y1, x2, y2,
          relX, relY,
          textX, textY,
          textBaseline,
          textAnchor
        };
      });
    },
    getTargetedNodeElemFromTriggerElem(handle) {
      let node = this.getNodeFromElem(handle);

      if (this.getHandleTypeFromElem(handle) == 'origin')
        return this.getNodeElemFromNode(node);

      let trigger = this.getTriggerFromElem(handle);
      let target = this.getNodeById(trigger.target);
      return this.getNodeElemFromNode(target);
    },
    getTriggerFromElem(handleElem) {
      let node = this.getNodeFromElem(handleElem);
      let trigId = handleElem.getAttribute('trigger-index');
      let trigger = node.triggers[trigId];
      return trigger;
    },
    getHandleTypeFromElem(handleElem) {
      return handleElem.classList.contains('origin') ? 'origin' : 'target';
    },
    getNodeElemFromNode(node) {
      if (!node) return null;
      return document.querySelector(`.node[node-id="${node.id}"]`);
    },
    async copy(event) {
      let active = document.activeElement;
      if (active != this.$refs.editor && active != document.body) return;

      let data = JSON.stringify(clipboard.selected);
      event.clipboardData.setData('text/plain', data);
      event.preventDefault();
    },
    async paste(event) {
      let active = document.activeElement;
      if (active != this.$refs.editor && active != document.body) return;

      let musicGraph = null;
      let result = await sanitizeAndLoadTPSE({
        version: '0.21.3',
        musicGraph: event.clipboardData.getData('text')
      }, {
        async set(pairs) {
          if (pairs.musicGraph)
            musicGraph = JSON.parse(pairs.musicGraph);
        }
      }, {
        skipFileDependencies: true
      });
      if (result.includes('ERROR')) {
        alert(`Paste failed:\n${result}`);
        return;
      }
      console.log("pasted", result, musicGraph);
      if (!musicGraph) return;

      let ax = musicGraph.reduce((acc, node) => acc + node.x, 0) / musicGraph.length;
      let ay = musicGraph.reduce((acc, node) => acc + node.y, 0) / musicGraph.length;
      let { width, height } = this.$refs.editor.getBoundingClientRect();

      clipboard.selected.splice(0);
      for (let node of musicGraph) {
        if (node.type == 'root') continue;
        node.id = ++this.$parent.maxId;
        node.x = Math.floor((node.x - ax - this.camera.x + width /2) / 20) * 20;
        node.y = Math.floor((node.y - ay - this.camera.y + height/2) / 20) * 20;
        this.nodes.push(node);
        clipboard.selected.push(node);
      }
      if (musicGraph.length > 0)
        this.$emit('change');
    }
  },
  mounted() {
    this.copy = this.copy.bind(this);
    this.paste = this.paste.bind(this);
    window.addEventListener('copy', this.copy);
    window.addEventListener('paste', this.paste);

    interact('.visual-editor svg text')
      .on('tap', event => {
        let trigger = this.getTriggerFromElem(event.target);
        this.$emit('focus', trigger);
      });

    interact('.visual-editor')
      .draggable({})
      .on('dragmove', event => {
        if (event.shiftKey) {
          if (!this.selectRect) {
            this.selectRect = {
              x1: event.clientX0,
              y1: event.clientY0,
              x2: event.clientX0,
              y2: event.clientY0
            };
          }
          this.selectRect.x2 += event.delta.x;
          this.selectRect.y2 += event.delta.y;
        } else {
          this.camera.x += event.dx;
          this.camera.y += event.dy;
        }
      })
      .on('dragend', event => {
        if (event.shiftKey) {
          let trect = {
            top: Math.min(this.selectRect.y1, this.selectRect.y2),
            bottom: Math.max(this.selectRect.y1, this.selectRect.y2),
            left: Math.min(this.selectRect.x1, this.selectRect.x2),
            right: Math.max(this.selectRect.x1, this.selectRect.x2),
          };

          if (!event.ctrlKey)
            clipboard.selected.splice(0);

          for (let node of this.nodes) {
            let rect = document.querySelector(`[node-id="${node.id}"]`).getBoundingClientRect();
            if (rect.top > trect.bottom) continue;
            if (rect.left > trect.right) continue;
            if (rect.bottom < trect.top) continue;
            if (rect.right < trect.left) continue;
            clipboard.selected.push(node);
          }
          this.selectRect = null;
        }
      })

    interact('.visual-editor .node')
      .draggable({
        modifiers: [
          interact.modifiers.snap({
            targets: [
              interact.createSnapGrid({ x: 20, y: 20 })
            ],
            relativePoints: [{ x: 0, y: 0 }],
            offset: 'self'
          })
        ]
      })
      .on('dragmove', event => {
        let node = this.getNodeFromElem(event.target);
        let set = clipboard.selected.indexOf(node) !== -1 ? clipboard.selected : [node];
        for (let node of set) {
          node.x += event.dx;
          node.y += event.dy;
        }
      })
      .on('dragend', event => {
        let node = this.getNodeFromElem(event.target);
        let set = clipboard.selected.indexOf(node) !== -1 ? clipboard.selected : [node];
        for (let node of set) {
          node.x = this.round(node.x, 20);
          node.y = this.round(node.y, 20);
        }
        this.$emit('change');
      })
      .on('tap', event => {
        let node = this.getNodeFromElem(event.target);
        if (!event.ctrlKey && !event.shiftKey)
          clipboard.selected.splice(0);

        let index = clipboard.selected.indexOf(node);
        if (index == -1)
          clipboard.selected.push(node)
        else if (event.ctrlKey)
          clipboard.selected.splice(index, 1);

        this.$emit('focus', node);
      });

    interact('.visual-editor .node-anchor')
      .draggable({
        modifiers: [
          interact.modifiers.snap({
            targets: [
              (x, y, interaction, offset, index) => {
                let handle = interaction.element;
                let nodeElem = this.getTargetedNodeElemFromTriggerElem(handle);
                let trigger = this.getTriggerFromElem(handle);
                let node = this.getNodeFromElem(nodeElem);
                if (!node) return { x: x, y: y, range: 0 };

                // The element is centered by translating it by half its size
                // interact.js doesn't like this so we have to adjust the snap
                // offsets manually
                let snapOffset = 0.5 * parseInt(
                  getComputedStyle(handle).getPropertyValue('--size')
                );
                let ax1 = node.x + this.camera.x - snapOffset
                let ay1 = node.y + this.camera.y - snapOffset
                let ax2 = ax1 + 200
                let ay2 = ay1 + 60

                let ax1o = Math.abs(ax1 - x);
                let ax2o = Math.abs(ax2 - x);
                let ay1o = Math.abs(ay1 - y);
                let ay2o = Math.abs(ay2 - y);

                switch (Math.min(ax1o, ax2o, ay1o, ay2o)) {
                  case ax1o:
                    if (y < ay1) y = ay1;
                    if (y > ay2) y = ay2;
                    return { x: ax1, y: y, range: Infinity };

                  case ax2o:
                    if (y < ay1) y = ay1;
                    if (y > ay2) y = ay2;
                    return { x: ax2, y: y, range: Infinity };

                  case ay1o:
                    if (x < ax1) x = ax1;
                    if (x > ax2) x = ax2;
                    return { y: ay1, x: x, range: Infinity };

                  case ay2o:
                    if (x < ax1) x = ax1;
                    if (x > ax2) x = ax2;
                    return { y: ay2, x: x, range: Infinity };
                }
              }
            ],
            relativePoints: [{ x: 0, y: 0 }],
            offset: 'parent'
          })
        ]
      })
      .on('dragmove', event => {
        let trigger = this.getTriggerFromElem(event.target);
        let coord = trigger.anchor[this.getHandleTypeFromElem(event.target)];
        coord.x += event.dx;
        coord.y += event.dy;
      })
      .on('dragend', event => {
        // let trigger = this.getTriggerFromElem(event.target);
        // let coord = trigger.anchor[this.getHandleTypeFromElem(event.target)];
        this.$emit('change');
      })
  }
}
