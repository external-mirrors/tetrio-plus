/*
*/
createRewriteFilter("Music graph hooks", "https://tetr.io/js/tetrio.js*", {
  enabledFor: async (storage, url) => {
    let res = await storage.get([
      'musicEnabled', 'musicGraphEnabled'
    ]);
    return res.musicEnabled && res.musicGraphEnabled;
  },
  onStop: async (storage, url, src, callback) => {
    try {
      /**
       * This regex locates the variable holding the 'full'/'tiny' value and
       * one holding something related to board location for use by the next rgx
       */
      var rgx = /playIngame\(\w+,\s*([.\w]+),\s*([.\w]+)/;
      var match = rgx.exec(src);
      if (!match) {
        console.error('Music graph hooks broken (setup/?)');
        return;
      }

      const typeVar = match[1];
      const spatialVar = match[2];

      var match = false;
      var rgx = /(fx\((\w+)\)\s*{\s*)(return\s*(this\.effects\.get\(\w+\)))/;
      src = src.replace(rgx, ($, pre, argument, post, effect) => {
        match = true;
        return pre + (`
          if (${effect} && !${effect}.patched) {
            let original = ${effect}.create.bind(${effect});
            ${effect}.patched = true
            ${effect}.create = (...args) => {
              document.dispatchEvent(new CustomEvent('tetrio-plus-fx', {
                detail: {
                  name: ${argument},
                  args: args,
                  type: this.${typeVar.split('.').slice(-2).join('.')},
                  spatialization: this.${spatialVar.split('.').slice(-3).join('.')}
                }
              }));
              original(...args);
            }
          }
        `) + post;
      })
      if (!match) {
        console.error('Music graph hooks broken (fx)');
      }

      /**
       * This regex targets a function that plays sound effects and turns it
       * into a global hook for other scripts to consume.
       */
      var match = false;
      var rgx = /playIngame:\s*function\((\w+),[^)]+\)\s*{/i;
      src = src.replace(rgx, ($, arg1) => {
        match = true;
        return (
          $ +
          `document.dispatchEvent(new CustomEvent('tetrio-plus-actionsound', {
            detail: {
              name: ${arg1},
              args: [...arguments]
            }
          }));`
        )
      });
      if (!match) {
        console.error('Music graph hooks broken (sfx)');
      }

      /**
       * This regex looks for a convenient "HighestLine" function to send off below.
       */
      let highestLinePath = /let\s*\w+\s*=\s*(\w+\.\w+\.HighestLine\(\))/.exec(src);
      if (!highestLinePath) {
        console.error('Music graph hooks broken (height 1/2)');
        return;
      }
      const highestLineCall = highestLinePath[1];

      /**
       * This regex hooks a convenient location for us to send off data from
       * variables gathered in other hooks
       */
      var match = false;
      var rgx = /\w+\.\w+\.IsServer\(\)\s*\|\|\s*\(\s*\w+\.\w+\.\w+\.stackdirty/;
      src = src.replace(rgx, $ => {
        match = true;
        return `
        let height = ${highestLineCall}
        document.dispatchEvent(new CustomEvent('tetrio-plus-actionheight', {
          detail: {
            height,
            type:${typeVar},
            spatialization:${spatialVar}
          }
        }))
        ;` + $;
      });
      if (!match) {
        console.error('Music graph hooks broken (height 2/2)');
      }
    } finally {
      callback({
        type: 'text/javascript',
        data: src,
        encoding: 'text'
      });
    }
  }
})
