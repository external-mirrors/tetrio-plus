const html = arg => arg.join(''); // NOOP, for editor integration.
import OptionToggle from './OptionToggle.js';

export default {
  template: html`
    <div class="component-wrapper">
      <div class="control-group">
        <button @click="openImageChanger" title="Opens the skin changer window">
          Change skin
        </button>
        <button @click="resetSkin" title="Removes the existing custom skin">
          Remove skin
        </button>
      </div>

      <div class="preview-group">
        <img
          title="This is the current block skin you are using."
          class="skin"
          :src="skinUrl"
          v-if="skinUrl">
        <div class="no-skin" v-else>
          No skin set
        </div>
      </div>
      <option-toggle storageKey="advancedSkinLoading">
        Use advanced skin loading
        <option-toggle inline storageKey="advancedSkinLoading" mode="hide">
          <span
            class="warning-icon"
            :title="(
              'This option is required for animated skins, but is more ' +
              'likely to break. Tetrio is currently planning an overhaul to ' +
              'the skins system which will almost definitely break this ' +
              'in the future.'
            )"
          >⚠️</span>
        </option-toggle>
      </option-toggle>
    </div>
  `,
  components: { OptionToggle },
  data: () => ({
    cached: { skin: null, ghost: null }
  }),
  mounted() {
    this.loadSkin();
  },
  computed: {
    skinUrl() {
      if (!this.cached.skin && !this.cached.ghost)
        return null;

      let canvas = document.createElement('canvas');
      let ctx = canvas.getContext('2d');
      canvas.width = 372;
      canvas.height = 30;

      function makeImage(src) {
        if (!src) return null;
        let img = new Image();
        img.crossOrigin = 'Anonymous'; // WHY?? It's a *data url*
        img.src = src;
        return img;
      }

      let sources = {
        ghost: makeImage(this.cached.ghost),
        skin: makeImage(this.cached.skin)
      };

      let bs = 96; // block size
      let blocks = [
        { source:  'skin', x: bs* 0, y: bs* 4 }, // z, *4 = get all-borders block
        { source:  'skin', x: bs* 4, y: bs* 4 }, // l
        { source:  'skin', x: bs* 8, y: bs* 4 }, // o
        { source:  'skin', x: bs*12, y: bs* 4 }, // s
        { source:  'skin', x: bs* 0, y: bs*10 }, // i
        { source:  'skin', x: bs* 4, y: bs*10 }, // j
        { source:  'skin', x: bs* 8, y: bs*10 }, // t
        { source: 'ghost', x: bs* 0, y: bs* 4 }, // ghost
        { source:  'skin', x: bs*12, y: bs*10 }, // hold
        { source:  'skin', x: bs*16, y: bs* 3 }, // garbage
        { source:  'skin', x: bs*16, y: bs* 7 }, // dark garbage
        { source: 'ghost', x: bs* 4, y: bs* 4 }, // topout
      ];
      for (let i = 0; i < 12; i++) {
        let { source, x, y } = blocks[i];
        if (!sources[source]) continue;
        ctx.drawImage(
          sources[source],
          x, y, bs, bs,
          i*31, 0, 30, 30
        );
      }

      return canvas.toDataURL('image/png');
    }
  },
  methods: {
    loadSkin() {
      browser.storage.local.get(['skin', 'ghost']).then(({ skin, ghost }) => {
        if (ghost != this.cached.ghost) this.cached.ghost = ghost;
        if (skin != this.cached.skin) this.cached.skin = skin;
      });
    },
    resetSkin() {
      browser.storage.local.remove(['skin', 'ghost']).then(() => {
        this.cached.skin = null;
        this.cached.ghost = null;
      });
    },
    async openImageChanger() {
      let { name } = await browser.runtime.getBrowserInfo();
      if (name == 'Fennec') {
        browser.tabs.create({
          url: browser.extension.getURL('source/panels/skinpicker/index.html'),
          active: true
        });
      } else {
        browser.windows.create({
          type: 'detached_panel',
          url: browser.extension.getURL('source/panels/skinpicker/index.html'),
          width: 659,
          height: 550
        });
      }
    }
  }
}
