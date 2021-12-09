const html = arg => arg.join('');
import utils from './ve-utils-mixin.js';

export default {
  template: html`
    <div style="display: contents">
      <div
        class="node"
        :class="{ selected }"
        :node-id="node.id"
        :style="{
          '--x': (node.x + camera.x) + 'px',
          '--y': (node.y + camera.y) + 'px'
        }"
      >{{node.name}}</div>

      <template v-for="link of links">
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
    </div>
  `,
  props: ['nodes', 'node', 'camera'],
  mixins: [utils],
  computed: {
    selected() {
      return this.isSelected(this.node);
    },
    links() {
      return this.getLinks(this.node, this.node.triggers);
    }
  }
}
