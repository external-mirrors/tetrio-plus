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
          v-if="skinUrl"
          @load="rmSkinBlob">
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
  data: () => ({ cachedSkin: null, skinBlob: null }),
  computed: {
    skinUrl() {
      browser.storage.local.get('skin').then(({ skin }) => {
        if (skin != this.cachedSkin) this.cachedSkin = skin;
      });
      if (!this.cachedSkin) return false;
      return this.cachedSkin;
    }
  },
  methods: {
    rmSkinBlob() {
      if (!this.skinBlob) return;
      URL.revokeObjectURL(this.skinBlob);
      console.log("Cleared blob");
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
    },
    resetSkin() {
      browser.storage.local.remove(['skin', 'ghost']).then(() => {
        this.cachedSkin = null;
      });
    }
  }
}
