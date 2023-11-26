import {clipboard} from '../../clipboard.js';
const html = arg => arg.join(''); // NOOP, for editor integration.

import veSvgContainer from './ve-svg-container.js';
import veSvgNodeLinks from './ve-svg-node-links.js';
import veLiveNode from './ve-live-node.js';
import veNode from './ve-node.js';
import utils from './ve-utils-mixin.js';

export default {
  template: html`
    <div ref="editor" class="visual-editor" :style="editorStyle" tabindex="0">
      <div class="events-per-second" v-if="port">
        Events per second: {{ eventsPerSecond }}
        <div v-if="eventsPerSecondWarning">
          ⚠️ Above reporting threshold, some events may not display.
        </div>
      </div>
      <div :style="{
        'will-change': 'transform',
        transform: \`translateX(\${camera.x}px) translateY(\${camera.y}px)\`
      }">
        <ve-node
          v-for="node of nodes"
          :key="node.id"
          :nodes="nodes"
          :node="node"
          :connected="!!port"
          @spawn="spawn(node)"
        />
        <div style="display: contents">
          <ve-live-node
            v-for="instance of liveInstances"
            v-if="isFinite(instance.sourceId)"
            :key="instance.instanceId"
            :camera="camera"
            :nodes="nodes"
            :node="getNodeById(instance.sourceId)"
            :instance="instance"
            :index="liveInstancesByNode[instance.sourceId].indexOf(instance)"
            @kill="kill(instance.instanceId)"
          />
        </div>
      </div>
      <ve-svg-container :camera="camera" :select-rect="selectRect">
        <ve-svg-node-links
          v-for="node of nodes"
          :key="node.id"
          :nodes="nodes"
          :node="node"
          :events="recentTriggerFires[node.id] || []"
        />
      </ve-svg-container>
    </div>
  `,
  props: ['nodes'],
  components: { veSvgContainer, veSvgNodeLinks, veLiveNode, veNode },
  mixins: [utils],
  data: () => ({
    camera: { x: 0, y: 0 },
    selectRect: null,

    // Debugger stuff
    liveInstances: [],
    recentTriggerFires: {}, // node -> array
    eventsPerSecond: 0,
    eventsPerSecondWarning: false,
    port: null
  }),
  computed: {
    liveInstanceById() {
      let map = {};
      for (let node of this.liveInstances)
        map[node.instanceId] = node;
      return map;
    },
    liveInstancesByNode() {
      let map = {};
      for (let node of this.liveInstances) {
        if (!map[node.sourceId]) map[node.sourceId] = [];
        map[node.sourceId].push(node);
      }
      return map;
    },
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
    round(val, step) {
      return Math.round(val / step) * step;
    },
    async copy(event) {
      let active = document.activeElement;
      if (active != this.$refs.editor && active != document.body) return;

      let data = JSON.stringify(clipboard.selected, null, 2);
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

      let idMap = new Map();
      for (let node of musicGraph) {
        if (node.type == 'root') continue;
        let newId = ++this.$parent.maxId;
        idMap.set(node.id, newId);
        node.id = newId;
        node.x = Math.floor((node.x - ax - this.camera.x + width /2) / 20) * 20;
        node.y = Math.floor((node.y - ay - this.camera.y + height/2) / 20) * 20;
        this.nodes.push(node);
        clipboard.selected.push(node);
      }

      for (let node of musicGraph)
        for (let trigger of node.triggers)
          if (idMap.has(trigger.target))
            trigger.target = idMap.get(trigger.target);

      if (musicGraph.length > 0)
        this.$emit('change');
    },
    spawn(node) {
      this.port.postMessage({
        type: 'spawn',
        sourceId: node.id
      });
    },
    kill(instanceId) {
      this.port.postMessage({
        type: 'kill',
        instanceId
      });
    },
    onDebugMessage(msg) {
      if (msg.type != 'event') return;
      // console.log(msg.type, msg.name, Object.entries(msg.data).map(e => `${e[0]}: ${e[1]}`).join(', '));
      switch (msg.name) {
        case 'eventsPerSecond': {
          this.eventsPerSecond = msg.eventsPerSecond;
          this.eventsPerSecondWarning = msg.warning;
          break;
        }

        case 'reset': {
          this.liveInstances = [];
          this.recentTriggerFires = {};
          break;
        }

        case 'node-created': {
          this.liveInstances.push({
            ...msg.data,
            sourceId: null,
            variables: {},
            recentTriggers: []
          });
          break;
        }

        case 'node-destroyed': {
          let i = this.liveInstances.findIndex(({ instanceId }) => {
            return instanceId == msg.data.instanceId;
          });
          if (i == -1) break;
          this.liveInstances.splice(i, 1);
          break;
        }

        case 'node-source-set': {
          let instance = this.liveInstanceById[msg.data.instanceId];
          if (!instance) break;
          if (isFinite(msg.data.lastSourceId) && (msg.data.lastSourceId != instance.sourceId)) {
            // Ensure forks are animated
            instance.sourceId = msg.data.lastSourceId;
            setTimeout(() => instance.sourceId = msg.data.sourceId, 20);
          } else {
            instance.sourceId = msg.data.sourceId;
          }
          // msg.data.lastSourceId
          break;
        }

        case 'node-set-variable': {
          let instance = this.liveInstanceById[msg.data.instanceId];
          if (!instance) break;
          this.$set(instance.variables, msg.data.variable, msg.data.value);
          break;
        }

        case 'node-run-trigger': {
          if (!this.recentTriggerFires[msg.data.sourceId])
            this.$set(this.recentTriggerFires, msg.data.sourceId, []);

          let recent = this.recentTriggerFires[msg.data.sourceId];
          if (recent.length > 10) recent.splice(0, 1);
          recent.push({
            instance: msg.data.instanceId,
            trigger: msg.data.trigger,
            success: msg.data.success,
            values: msg.data.values,
            date: Date.now(),
            age: 0,
            maxAge: 500
          });
          break;
        }

      }
    },
    tickRecentEvents() {
      for (let key of Object.keys(this.recentTriggerFires)) {
        this.recentTriggerFires[key] = this.recentTriggerFires[key].filter(el=>{
          el.age = Date.now() - el.date;
          return el.age < el.maxAge;
        });
      }
    }
  },
  mounted() {
    setInterval(() => this.tickRecentEvents(), 16);

    this.copy = this.copy.bind(this);
    this.paste = this.paste.bind(this);
    window.addEventListener('copy', this.copy);
    window.addEventListener('paste', this.paste);
    window.ve = this;

    this.$root.$on('save', () => {
      if (!this.port) return;
      this.port.postMessage({ type: 'reload' });
    });

    browser.runtime.onConnect.addListener(port => {
      if (port.name != 'music-graph-event-stream') return;
      if (this.port) {
        port.disconnect();
        return;
      }
      console.log("Music graph instance connected");
      this.port = port;
      this.eventsPerSecond = 0;
      this.eventsPerSecondWarning = false;
      port.onMessage.addListener(msg => {
        this.onDebugMessage(msg)
      });
      port.onDisconnect.addListener(() => {
        console.log("Music graph instance disconnected");
        this.liveInstances = [];
        this.recentTriggerFires = {};
        this.port = null;
      });
      setTimeout(() => {
        this.port.postMessage({ type: 'hello' });
      });
    });

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
        if (event.target.tagName == 'BUTTON') return;
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
                let rect = this.editorRect();
                let border = [2, 2, 2, 0];
                let ax1 = node.x + this.camera.x - snapOffset + (rect.x + border[3]);
                let ay1 = node.y + this.camera.y - snapOffset + (rect.y + border[0]);
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
