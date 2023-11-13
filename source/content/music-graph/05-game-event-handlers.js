musicGraph(({ dispatchEvent, cleanup }) => {
    let elements = [];
    for (let menu of document.querySelectorAll("[data-menuview]")) {
      elements.push({
        type: `menu-${menu.getAttribute('data-menuview')}`,
        element: menu
      });
    }
    for (let id of ['forfeit', 'retry', 'replay', 'spectate']) {
      elements.push({
        type: `hud-${id}`,
        element: document.getElementById(id)
      });
    }

    for (let { type, element } of elements) {
      let wasHidden = true;

      let observer = new MutationObserver(mutations => {
        for (let mut of mutations) {
          let hidden = mut.target.classList.contains("hidden");
          if (wasHidden == hidden) continue;
          wasHidden = hidden;
          dispatchEvent(`${type}-${hidden ? 'close' : 'open'}`, null);
        }
      });
      cleanup.push(() => observer.disconnect());

      observer.observe(element, {
        attributes: true,
        attributeFilter: ['class'],
        childList: false,
        CharacterData: false
      });
    }

    // note: comments probably outdated, but heuristic itself still works.
    function locationHeuristic(size, spatialization) {
      if (size == 'tiny') return 'enemy'; // If tiny, always an enemy
      // Solo spatialization is exactly 0
      // Duel spatialization is -0.3499...
      if (spatialization <= 0) return 'player';
      // Duel enemy spatialization is 0.4499...
      return 'enemy';
    }

    let controller = new AbortController();
    cleanup.push(() => controller.abort());

    document.addEventListener('tetrio-plus-fx', evt => {
      try {
      let type = locationHeuristic(evt.detail.boardSize, evt.detail.spatialization);
      let values = { $board: evt.detail.board_id };
      let { name, args } = evt.detail;
      switch (name) {
        case 'countdown_stride':
          var count = ["GO!", "set", "ready"].indexOf(args[0])
          dispatchEvent(`fx-countdown-${count}`, values);
          dispatchEvent(`text-countdown-${count}`, values); // backwards compat
          break;
        case 'countdown':
          var count = args[0] == 'GO!' ? 0 : parseInt(args[0]);
          dispatchEvent(`fx-countdown`, { $: count, ...values });
          dispatchEvent(`text-countdown-${count}`, values); // backwards compat
          break;
        case 'clear':
          let level = [
            'NONE', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD', 'PENTA', 'HEXA',
            'HEPTA', 'OCTA', 'ENNEA', 'DECA', 'HENDECA', 'DODECA', 'TRIADECA',
            'TESSARADECA', 'PENTEDECA', 'HEXADECA', 'HEPTADECA', 'OCTADECA',
            'ENNEADECA', 'EICOSA', 'KAGARIS'
          ].indexOf(args[0]);
          dispatchEvent(`fx-line-clear-${type}`, { $: level, ...values })
          break;
        case 'clutch':
          dispatchEvent(`fx-clutch-${type}`, values);
          break;
        case 'zenlevel':
          dispatchEvent(`fx-zen-levelup`, values);
          break;
        case 'levelup':
          dispatchEvent(`fx-master-levelup`, values);
          break;
        case 'combo':
          dispatchEvent(`fx-combo-${type}`, { $: parseInt(args[0]), ...values })
          break;
        case 'tspin':
          let piece = args[0].toLowerCase()[0];
          dispatchEvent(`fx-${piece}-spin-${type}`, values);

          // backwards compat
          dispatchEvent(`text-${piece}-spin`, values);
          dispatchEvent(`text-any-spin`, values);
          break;
        case 'timeleft':
          if (args[0].endsWith('PLAYERS LEFT'))
            dispatchEvent(`fx-${parseInt(args[0])}-players-left`, values);
          if (args[0].endsWith('S LEFT'))
            dispatchEvent(`fx-${parseInt(args[0])}-seconds-left`, values);
          break;
        case 'popup_offence': // (lines sent)
          dispatchEvent(`fx-offense-${type}`, { $: args[0], ...values });
          dispatchEvent(`text-spike`, { $: args[0], ...values }); // backwards compat
          break;
        case 'popup_defense': // (lines blocked)
          dispatchEvent(`fx-defense-${type}`, { $: args[0], ...values });
          dispatchEvent(`text-spike`, { $: args[0], ...values }); // backwards compat
          break;
      }
      } catch(ex) { console.error(ex)}
    }, { signal: controller.signal });
    document.addEventListener('tetrio-plus-actiontext', evt => {
      let type = locationHeuristic(evt.detail.boardSize, evt.detail.spatialization);
      let values = { $board: evt.detail.board_id };

      switch (evt.detail.type) {
        case 'countdown':
          dispatchEvent('text-countdown-' + evt.detail.text, values);
          break;

        case 'countdown_stride':
          let vals = { 'ready': 3, 'set': 2, 'GO!': 1 };
          dispatchEvent('text-countdown-' + vals[evt.detail.text], values);
          break;

        case 'allclear':
          dispatchEvent('text-all-clear-' + type, values);
          break;

        case 'clear':
          dispatchEvent('text-clear-' + evt.detail.text.toLowerCase() + '-' + type, values);
          break;

        case 'combo':
          dispatchEvent('text-combo-' + type, parseInt(evt.detail.text), values);
          break;

        case 'tspin':
          if (!/^[OTIJLSZ]-spin$/.test(evt.detail.text)) break;
          let piece = evt.detail.text[0].toLowerCase();
          dispatchEvent('text-' + piece + '-spin-' + type, values);
          dispatchEvent('text-any-spin-' + type, values);
          break;

        case 'also':
          if (evt.detail.text == 'back-to-back')
            dispatchEvent('text-b2b-singleplayer', values);
          break;

        case 'spike':
          dispatchEvent('text-spike-' + type, parseInt(evt.detail.text), values);
          break;

        case 'also_permanent':
          if (evt.detail.text.startsWith('B2B')) {
            let number = parseInt(/\d+$/.exec(evt.detail.text)[0]);
            dispatchEvent('text-b2b-combo-' + type, number, values);
            dispatchEvent('text-b2b-' + type, values);
          }
          break;

        case 'also_failed':
          if (evt.detail.text.startsWith('B2B'))
            dispatchEvent('text-b2b-reset-' + type, values);
          break;
      }
    }, { signal: controller.signal });
    document.addEventListener('tetrio-plus-actionsound', evt => {
      let name = evt.detail.name;
      let type = locationHeuristic(evt.detail.boardSize, evt.detail.spatialization);
      dispatchEvent(`sfx-${name}-${type}`, { $board: evt.detail.board_id });
    }, { signal: controller.signal });
    document.addEventListener('tetrio-plus-actionheight', evt => {
      // The 'height' is actually the *unfilled* portion of the board,
      // but we want the filled portion to pass for the event
      let height = 40 - evt.detail.height;
      let type = locationHeuristic(evt.detail.boardSize, evt.detail.spatialization);
      dispatchEvent(`board-height-${type}`, { $: height, $board: evt.detail.board_id });
    }, { signal: controller.signal });
  });
