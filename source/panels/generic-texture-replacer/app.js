const html = arg => arg.join('');
import { KEYS } from '../../importers/generic-texture.js';
import OptionToggle from '../../popup/components/OptionToggle.js'
let app = new Vue({
  template: html`
    <div>
      <h1>Miscellaneous texture replacer</h1>

      <div>
        <label for="key">Replace:</label>
        <select v-model="key">
          <option :value="null">Select a key...</option>
          <option :value="key" v-for="key of Object.keys(keys)">{{ key }}</option>
        </select>
        with
        <input name="file" ref="file" type="file" accept="image/*" @change="set" :disabled="!key"/>
      </div>

      <div class="preview" v-if="keys[key]">
        <h2>Vanilla</h2>
        <div class="image-container">
          <img :src="keys[key] + '?bypass-tetrio-plus'"  :key="keys[key]" />
        </div>
        <a :href="keys[key] + '?bypass-tetrio-plus'" download>Download</a>
      </div>

      <div class="preview" v-if="keys[key]">
        <h2>Current <button @click="remove" :disabled="!isSet">Remove</button></h2>
        <div class="image-container">
          <img :src="currentSrc" :key="currentSrc" />
        </div>
        <a :href="currentSrc" download>Download</a>
      </div>

      <div v-if="key == 'board'" style="margin-top: 8px">
        <option-toggle storageKey="winterCompatEnabled">
            Enable
            <a href="#" @click="openWinterCompatWiki">winter event compatibility</a>
            patch.
        </option-toggle>
      </div>
    </div>
  `,
  components: { OptionToggle },
  data: {
    keys: Object.fromEntries(Object.values(KEYS).map(key => {
      return [key.storagekey, key.url];
    })),
    key: 'board',
    cacheBuster: `?cache-buster=${Date.now()}`,
    isSet: false
  },
  async mounted() {
    await this.reload();
  },
  computed: {
    currentSrc() {
      let prefix = window.browser?.electron
        ? 'tetrio-plus://tetrio-plus/'
        : 'https://tetr.io/';
      let path = this.keys[this.key].slice('https://tetr.io/'.length);
      return prefix + path + this.cacheBuster;
    }
  },
  watch: {
    async key() {
      await this.reload();
    }
  },
  methods: {
    openWinterCompatWiki() {
      window.open('https://gitlab.com/UniQMG/tetrio-plus/-/wikis/custom-skins#winter-compat');
    },
    async reload() {
      this.isSet = false;
      this.cacheBuster = `?cache-buster=${Date.now()}`;

      if (!this.key) return false;
      let val = await browser.storage.local.get(this.key);
      this.isSet = !!val[this.key];
    },
    async set() {
      let file = this.$refs.file.files[0];
      if (!file) return;

      let reader = new FileReader();
      await new Promise(res => {
        reader.addEventListener('load', res);
        reader.readAsDataURL(file);
      });
      await browser.storage.local.set({ [this.key]: reader.result });

      // reset the handler
      this.$refs.file.type = '';
      this.$refs.file.type = 'file';
      await this.reload();
    },
    async remove() {
      await browser.storage.local.remove(this.key);
      await this.reload();
    }
  }
});
app.$mount('#app');
