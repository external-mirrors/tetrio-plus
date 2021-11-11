musicGraph(({ dispatchEvent }) => {
    for (let menu of document.querySelectorAll("[data-menuview]")) {
      let type = menu.getAttribute('data-menuview');
      let wasHidden = true;

      let observer = new MutationObserver(mutations => {
        for (let mut of mutations) {
          let hidden = mut.target.classList.contains("hidden");
          if (wasHidden == hidden) continue;
          wasHidden = hidden;

          let evt = hidden ? 'menu-close-' + type : 'menu-open-' + type;
          dispatchEvent(evt, null);
        }
      });
      
      observer.observe(menu, {
        attributes: true,
        attributeFilter: ['class'],
        childList: false,
        CharacterData: false
      });
    }

    function locationHeuristic(size, spatialization) {
      if (size == 'tiny') return 'enemy'; // If tiny, always an enemy
      // Solo spatialization is exactly 0
      // Duel spatialization is -0.3499...
      if (spatialization <= 0) return 'player';
      // Duel enemy spatialization is 0.4499...
      return 'enemy';
    }
    document.addEventListener('tetrio-plus-fx', evt => {
      try {
      let type = locationHeuristic(evt.detail.type, evt.detail.spatialization);
      let { name, args } = evt.detail;
      switch (name) {
        case 'countdown_stride':
          var count = ["GO!", "set", "ready"].indexOf(args[0])
          dispatchEvent(`fx-countdown-${count}`);
          dispatchEvent(`text-countdown-${count}`); // backwards compat
          break;
        case 'countdown':
          var count = args[0] == 'GO!' ? 0 : parseInt(args[0]);
          dispatchEvent(`fx-countdown`, count);
          dispatchEvent(`text-countdown-${count}`); // backwards compat
          break;
        case 'clear':
          let level = [
            'NONE', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA', 'HEXA',
            'HEPTA', 'OCTA', 'ENNEA', 'DECA', 'HENDECA', 'DODECA', 'TRIADECA',
            'TESSARADECA', 'PENTEDECA', 'HEXADECA', 'HEPTADECA', 'OCTADECA',
            'ENNEADECA', 'EICOSA', 'KAGARIS'
          ].indexOf(args[0]);
          dispatchEvent(`fx-line-clear-${type}`, level)
          break;
        case 'clutch':
          dispatchEvent(`fx-clutch-${type}`);
          break;
        case 'zenlevel':
          dispatchEvent(`fx-zen-levelup`);
          break;
        case 'levelup':
          dispatchEvent(`fx-master-levelup`);
          break;
        case 'combo':
          dispatchEvent(`fx-combo-${type}`, parseInt(args[0]))
          break;
        case 'tspin':
          let piece = args[0].toLowerCase()[0];
          dispatchEvent(`fx-${piece}-spin-${type}`);

          // backwards compat
          dispatchEvent(`text-${piece}-spin`);
          dispatchEvent(`text-any-spin`);
          break;
        case 'timeleft':
          if (args[0].endsWith('PLAYERS LEFT'))
            dispatchEvent(`fx-${parseInt(args[0])}-players-left`);
          if (args[0].endsWith('S LEFT'))
            dispatchEvent(`fx-${parseInt(args[0])}-seconds-left`);
          break;
        case 'popup_offence': // (lines sent)
          dispatchEvent(`fx-offense-${type}`, args[0]);
          dispatchEvent(`text-spike`, args[0]); // backwards compat
          break;
        case 'popup_defense': // (lines blocked)
          dispatchEvent(`fx-defense-${type}`, args[0]);
          dispatchEvent(`text-spike`, args[0]); // backwards compat
          break;
      }
      } catch(ex) { console.error(ex)}
    });
    document.addEventListener('tetrio-plus-actiontext', evt => {
      // console.log('IJ actiontext', evt.detail.type, evt.detail.text);
      let type = locationHeuristic(evt.detail.type, evt.detail.spatialization);

      switch (evt.detail.type) {
        case 'countdown':
          dispatchEvent('text-countdown-' + evt.detail.text);
          break;

        case 'countdown_stride':
          let vals = { 'ready': 3, 'set': 2, 'GO!': 1 };
          dispatchEvent('text-countdown-' + vals[evt.detail.text]);
          break;

        case 'allclear':
          dispatchEvent('text-all-clear-' + type);
          break;

        case 'clear':
          dispatchEvent('text-clear-' + evt.detail.text.toLowerCase() + '-' + type);
          break;

        case 'combo':
          dispatchEvent('text-combo-' + type, parseInt(evt.detail.text));
          break;

        case 'tspin':
          if (!/^[OTIJLSZ]-spin$/.test(evt.detail.text)) break;
          let piece = evt.detail.text[0].toLowerCase();
          dispatchEvent('text-' + piece + '-spin-' + type);
          dispatchEvent('text-any-spin-' + type);
          break;

        case 'also':
          if (evt.detail.text == 'back-to-back')
            dispatchEvent('text-b2b-singleplayer');
          break;

        case 'spike':
          dispatchEvent('text-spike-' + type, parseInt(evt.detail.text));
          break;

        case 'also_permanent':
          if (evt.detail.text.startsWith('B2B')) {
            let number = parseInt(/\d+$/.exec(evt.detail.text)[0]);
            dispatchEvent('text-b2b-combo-' + type, number);
            dispatchEvent('text-b2b-' + type);
          }
          break;

        case 'also_failed':
          if (evt.detail.text.startsWith('B2B'))
            dispatchEvent('text-b2b-reset-' + type);
          break;
      }
    });
    document.addEventListener('tetrio-plus-actionsound', evt => {
      // arg 1: sound effect name
      // arg 2: 'full' for active board or general sfx, 'tiny' for other boards
      // arg 3: -0 for full sound effects, -1 to 1 for tiny ones. Possibly spatialization?
      // arg 4: 1 for full sound effects, 0-1 for tiny ones. Possibly volume?
      // arg 5: always false
      // arg 6: true on full, false on tiny
      // arg 7: always 1
      // console.log('IJ actionsound', ...evt.detail.args);
      let name = evt.detail.args[0];
      let type = locationHeuristic(evt.detail.args[1], evt.detail.args[2]);
      dispatchEvent(`sfx-${name}-${type}`);
    });
    document.addEventListener('tetrio-plus-actionheight', evt => {
      // The 'height' is actually the *unfilled* portion of the board,
      // but we want the filled portion to pass for the event
      let height = 40 - evt.detail.height;
      let type = locationHeuristic(evt.detail.type, evt.detail.spatialization);
      dispatchEvent(`board-height-${type}`, height);
    });
  });
