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
      // Written 2023-11-12
      // Music graph had changes. `playIngame` is gone. There's now two interesting functions:
      // big Play and little play. Big Play appears to be a per-board instance, wheras little
      // play is more global. Game sound effects are played through big Play which calls
      // little Play. 'global' sound effects like menu/ui ones are played only through little play.

      src = `
        let musicGraphIDIncrement = 0;
      ` + src;

      // This regex matches the big Play function.
      // It takes three parameters: the name of the sound, then two mystery parameters.
      //
      // Also inside is a reference to something that contains an `IsLocal` field.
      // This is `true` when a board is actively being played from the client.
      // We would have used this for player/enemy detection, but it's _always_ false in replays.
      // Instead, we scavenged references to recalculate the old 'tiny'/'full' board sizes.
      // (These are coxPath (equivalent to old spatialization) and boardSizeObjectPath
      // (contains IsSmallBoard()/IsTinyBoard() methods))
      //
      // Additionally, we add code that inserts a unique ID on the per-board instance.
      // We track this code to assign external board IDs to events. The object we insert
      // this on is available through other paths in the other hooks below, as well.
      let bigPlay = /Play\((\w+),\s*(\w*)\s*=\s*\d,\s*(\w*)\s*=\s*\d\)\s*{[\S\s]+?(this\.self\.\w+\.IsLocal\(\))[\S\s]+?this\.self\.((\w+)\..{1,30}\.cox)/;
      let bigPlayMatch = bigPlay.exec(src);
      if (!bigPlayMatch) {
        console.error('Music graph hooks broken (bigPlay)');
        return;
      }
      let [_match, soundNameVar, unknown1Var, unknown2Var, _isLocalInvocation, coxPath, boardSizeObjectPath] = bigPlayMatch;

      // This regex matches big Play for dispatching sound effects
      var match = false;
      src = src.replace(/Play\(\w+,\s*\w*\s*=\s*\d,\s*\w*\s*=\s*\d\)\s*{/, ($) => {
        match = true;
        return $ + (`
          if (!this.self.__tetrio_plus_board_id) {
            this.self.__tetrio_plus_board_id = ++musicGraphIDIncrement;
          }
          document.dispatchEvent(new CustomEvent('tetrio-plus-actionsound', {
            detail: {
              name: ${soundNameVar},
              board_id: this.self.__tetrio_plus_board_id,
              context: 'bigPlay',
              boardSize: (this.self.${boardSizeObjectPath}.IsTinyMode() || this.self.${boardSizeObjectPath}.IsSmallMode()) ? 'tiny' : 'full',
              spatialization: this.self.${coxPath}
            }
          }));
        `);
      });
      if (!match) {
        console.error('Music graph hooks broken (bigPlay2)');
      }



      var match = false;
      var rgx = /(fx\((\w+)\)\s*{\s*)return\s*(this\.effects\.get\(\w+\))/; // GOOD
      src = src.replace(rgx, ($, functionHeader, fxNameArgumentVar, getInvocation) => {
        match = true;
        return functionHeader + (`
          let effect = ${getInvocation};

          // IsTinyMode and IsSmallMode are literally just right there in the code
          // very convenient
          let boardSize = (this.IsTinyMode() || this.IsSmallMode()) ? 'tiny' : 'full';
          let spatialization = this.ctx.${coxPath};
          if (!this.ctx.__tetrio_plus_board_id) {
            this.ctx.__tetrio_plus_board_id = ++musicGraphIDIncrement;
          }
          let board_id = this.ctx.__tetrio_plus_board_id;

          let patched = Object.create(effect.__proto__);
          Object.assign(patched, {
            ...effect,
            create(...args) {
              document.dispatchEvent(new CustomEvent('tetrio-plus-fx', {
                detail: {
                  name: ${fxNameArgumentVar},
                  board_id: board_id,
                  args: args,
                  boardSize: boardSize,
                  spatialization: spatialization
                }
              }));
              effect.create.apply(this, args);
            }
          });
          return patched /* implicit || after this, no semicolon */
        `);
      })
      if (!match) {
        console.error('Music graph hooks broken (fx)');
      }



      /**
       * This regex looks for a convenient "HighestLine" function to send off below.
       */
      let highestLinePath = /let\s*\w+\s*=\s*(\w+\.\w+\.HighestLine\(\))/.exec(src); // GOOD
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
      var rgx = /(\w+)\.\w+\.IsServer\(\)\s*\|\|\s*\(\s*\w+\.\w+\.\w+\.stackdirty/; // GOOD
      src = src.replace(rgx, ($, contextVar) => {
        match = true;
        return `
        let height = ${highestLineCall};
        let bso = ${contextVar}.${boardSizeObjectPath};

        if (!${contextVar}.__tetrio_plus_board_id) {
          ${contextVar}.__tetrio_plus_board_id = ++musicGraphIDIncrement;
        }
        document.dispatchEvent(new CustomEvent('tetrio-plus-actionheight', {
          detail: {
            height,
            board_id: ${contextVar}.__tetrio_plus_board_id,
            boardSize: (bso.IsTinyMode() || bso.IsSmallMode()) ? 'tiny' : 'full',
            spatialization: ${contextVar}.${coxPath}
          }
        }));
        ` + $;
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
