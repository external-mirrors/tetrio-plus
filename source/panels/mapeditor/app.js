const html = arg => arg.join(''); // NOOP, for editor integration.

const app = new Vue({
  template: html`
    <div class="app">
      <div class="tools">
        <template v-for="itool of tools">
          <div
            @mousemove="clicking && (tool = itool)"
            @click="tool = itool"
            :class="{
              mino: true,
              tool: true,
              ['mino-' + itool]: true,
              ['active-tool']: tool == itool
            }"
          ></div>
          {{ itool }}<br>
        </template>
      </div>
      <div class="editor">
        <div v-for="row of map" class="row">
          <div
            v-for="el of row"
            class="mino"
            :class="'mino-' + el.mino"
            @mousemove="edit(el)"
            @click="el.mino = tool"
          ></div>
        </div>
      </div>
      <div class="map-output">
        Paste this into the 'Custom Map String' field after editing and make
        sure to check the 'Use Custom Map' checkbox. You can type into any of
        these fields and the others will automatically update.<br>
        <textarea
          class="map-string"
          ref="mapstring"
          @input="loadMapString($event.target.value)"
        />
        <br />
        Bag:
        <input type="text" v-model="bag" @input="deferRecalcMapString()"/>
        <button @click="addToolToBag()" :disabled="tool.length != 1">
          Add selected
        </button>
        <br />
        Hold:
        <input type="text" v-model="hold" @input="deferRecalcMapString()" />
        <button @click="setHoldToTool()" :disabled="tool.length != 1">
          Set selected
        </button>
        <br />
        Width:
        <input type="number" v-model.number="width" min="1" />
        <br />
        Height:
        <input type="number" v-model.number="height" min="1" />
      </div>
    </div>
  `,
  data: {
    width: 10,
    height: 40,
    map: [],
    tools: ['i', 'o', 'l', 'j', 'z', 's', 't', 'empty', 'garbage', 'darkgarbage'],
    bag: "",
    hold: null,
    tool: 'empty',
    removing: false,
    clicking: false,
    mapString: "",
    modified: false
  },
  mounted() {
    document.addEventListener('mousedown', () => this.startEditing());
    document.addEventListener('mouseup', () => this.endEditing());
    this.regenerateMap();
    this.recalculateMapString();
    let match = /map=([^&]+)/.exec(window.location.search);
    if (match) {
      this.loadMapString(decodeURIComponent(match[1]));
      this.recalculateMapString();
    }
  },
  watch: {
    mapString(val) {
      this.$refs.mapstring.value = val;
    },
    bag(val) {
      let filtered = [...val].filter(char =>
        ['i', 'o', 'l', 'j', 'z', 's', 't'].indexOf(char) != -1
      ).join('');
      if (this.bag != filtered)
        this.bag = filtered;
    },
    hold(val) {
      if (!val) val = "";
      if (val.length > 1) val = val.slice(-1);
      if (['i', 'o', 'l', 'j', 'z', 's', 't'].indexOf(val) == -1)
        val = "";
      if (this.hold != val)
        this.hold = val;
    },
    width() {
      this.regenerateMap()
    },
    height() {
      this.regenerateMap()
    }
  },
  methods: {
    regenerateMap() {
      let oldHeight = this.map.length;
      this.map = new Array(this.height).fill(0).map((el, y) => {
        return new Array(this.width).fill(0).map((el, x) => {
          let ny = y + oldHeight - this.height;
          if (this.map[ny]?.[x]) return this.map[ny][x];
          return { mino: 'empty' }
        });
      });
      this.deferRecalcMapString();
    },
    startEditing() {
      this.clicking = true;
      this.modified = false;
    },
    endEditing() {
      this.clicking = false;
      if (this.modified) {
        this.recalculateMapString();
        this.modified = false;
      }
    },
    edit(elem) {
      if (!this.clicking) return;
      elem.mino = this.tool;
      this.modified = true;
    },
    addToolToBag() {
      this.bag += this.tool;
      this.deferRecalcMapString();
    },
    setHoldToTool() {
      this.hold = this.tool;
      this.deferRecalcMapString()
    },
    deferRecalcMapString() {
      setTimeout(() => this.recalculateMapString());
    },
    recalculateMapString() {
      this.mapString = this.map.flatMap(row => {
        return row.map(el => {
          if (el.mino == 'empty') return '_';
          if (el.mino == 'garbage') return '#';
          if (el.mino == 'darkgarbage') return '@';
          return el.mino;
        });
      }).join('');
      this.mapString += `?${this.bag}?${this.hold}`;
    },
    loadMapString(mapString) {
      let x = 0, y = 0;

      let [map, bag, hold] = mapString.split('?');

      for (let char of map) {
        if (char == '_') this.map[y][x].mino = 'empty';
        else if (char == '#') this.map[y][x].mino = 'garbage';
        else if (char == '@') this.map[y][x].mino = 'darkgarbage';
        else if (char == 'i') this.map[y][x].mino = 'i';
        else if (char == 'l') this.map[y][x].mino = 'l';
        else if (char == 'j') this.map[y][x].mino = 'j';
        else if (char == 's') this.map[y][x].mino = 's';
        else if (char == 'z') this.map[y][x].mino = 'z';
        else if (char == 'o') this.map[y][x].mino = 'o';
        else if (char == 't') this.map[y][x].mino = 't';
        else continue;
        x++;
        if (x >= 10) {
          x = 0;
          y++;
        }
        if (y >= 40)
          break;
      }

      this.bag = bag || "";
      this.hold = (hold || "")[0];
    }
  }
});

app.$mount('#app');
