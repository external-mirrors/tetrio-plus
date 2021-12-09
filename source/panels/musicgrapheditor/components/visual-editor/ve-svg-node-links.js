const html = arg => arg.join('');
import utils from './ve-utils-mixin.js';

export default {
  template: html`
    <g>
      <template v-for="link of links">
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
    </g>
  `,
  props: ['nodes', 'node'],
  mixins: [utils],
  computed: {
    links() {
      return this.getLinks(this.node, this.node.triggers);
    }
  }
}
