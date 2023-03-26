// ==UserScript==
// @name         Microplus Toolkit for TETR.IO
// @namespace    https://gitlab.com/UniQMG/tetrio-plus
// @version      0.1.1
// @description  Some functionality of TETR.IO PLUS reimplemented as a userscript
// @author       UniQMG
// @match        https://tetr.io
// @icon         https://tetr.io/favicon.ico
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// Note: this userscript can be pasted directly into devtools or used as a bookmarklet (when minified), with some limitations:
// - It must be executed in a very precise time window before `tetrio.js` finishes loading for sound effects to work,
//   and before clicking 'join' for other features.
// - It falls back to localStorage to store tpse files, which is extremely tiny on most browsers.
//   The limit apparently can't be changed on Chrome, but on Firefox you can adjust
//   `dom.storage.default_quota` in `about:config`.

(function() {
  'use strict';

  // for bookmarklet usage
  if (typeof unsafeWindow == 'undefined') unsafeWindow = window;
  if (typeof GM_getValue == 'undefined') GM_getValue = ((key, def) => localStorage[key] ?? def);
  if (typeof GM_setValue == 'undefined') GM_setValue = ((key, value) => localStorage[key] = value);
  let version = typeof GM_info != 'undefined'
    ? 'v' + GM_info.script.version.replace(/[^\w\.]/g, '')
    : 'bookmarklet-v0.1';

  let mp = '[µ+]';
  let tpse = JSON.parse(GM_getValue('tpse', "{}"));
  console.log(mp, "Microplus Toolkit for TETR.IO enabled. Don't report issues to TETR.IO/osk during use.", { tpse });

  if (unsafeWindow.Howl) {
    alert(mp + 'Microplus loaded too late, custom sound effects may be unavailable');
    console.warn(mp, 'Howler already loaded');
  }

  let mpMenu = document.createElement('div');
  mpMenu.classList.add('microplus-toolkit-menu');
  mpMenu.innerHTML = `
<style>
.microplus-toolkit-menu {
  z-index: 10000000; /* yes, this is the actual exact minimum required. 9999999 is covered by the global stats. */
  position: fixed;
  right: 0px;
  width: 680px;
  max-width: 60vw;
  max-height: 60vh;
  overflow: auto;

  --background: #EEE;
  --layer-1: #CCC;
  --text: #222;
  font-family: sans-serif;
  color: var(--text);
}
.microplus-toolkit-menu > .main-section {
  background: var(--background);
  padding: 2px;
}
.microplus-toolkit-menu > .main-section > h1 {
  margin: 0px;
  white-space: nowrap;
  style: inline;
  font-size: 1.2rem;
}
.microplus-toolkit-menu > .main-section > h1 > .version {
  font-size: 0.8rem;
  font-family: monospace;
}
.microplus-toolkit-menu > .main-section > .tagline {
  margin: 0px;
  font-size: 0.75rem;
  font-family: monospace;
}
.microplus-toolkit-menu > .main-section > .section {
  border: none;
  border-top: 2px solid var(--text);
  padding: 4px;
  margin-top: 4px;
  background-color: var(--layer-1);
}
.microplus-toolkit-menu > .main-section > .section > legend {
  margin-left: 12px;
  padding-left: 4px;
  padding-right: 4px;
  font-size: 1rem;
  background-color: var(--background);
  border: 2px solid var(--text);
  border-radius: 4px;
}
.microplus-toolkit-menu button, .microplus-toolkit-menu ::file-selector-button {
  border-radius: 0px;
  border-color: lightgray;
}
.microplus-toolkit-menu marquee {
  color: red;
  font-weight: bold;
  background: black;
}
</style>

<div class="main-section">
  <h1>
    Microplus Toolkit for TETR.IO
    <span class="version">
      ${version} |
      <a class="wiki" href="https://gitlab.com/UniQMG/tetrio-plus/-/wikis/microplus">Wiki</a>
    </span>
  </h1>
  <p class="tagline">
    A userscript version of TETR.IO PLUS with limited feature support, but that runs anywhere.
  </p>
  <fieldset class="section">
    <legend>Import settings from a file</legend>
    Warning: Microplus Toolkit does not validate TPSE files beyond ensuring they're valid JSON.
    Malformatted TPSE files may cause issues.<br>
    <input type="file" id="mp-select-file" accept=".tpse"><br>
    <button id="mp-set-tpse">Set TPSE and reload page</button>
  </fieldset>
  <fieldset class="section">
    <legend>Remove TPSE</legend>
    <button id="mp-remove-tpse">Remove current TPSE and reload page</button>
  </fieldset>

  <button style="margin-top: 4px; margin-left: 2px;" onclick="document.querySelector('.microplus-toolkit-menu').style.display = 'none'">Close</button>
  <div style="color: red">
    Microplus Toolkit supports only skins, sound effects, and music. Animated skins, backgrounds, the music graph,
    and other TETR.IO PLUS features are not supported and most will probably never be supported.
  </div>
</div>
<marquee scrollamount="15">Do not report issues to TETR.IO or osk during use.</marquee>
  `;

  waitUntil(() => document.body, () => {
    document.body.appendChild(mpMenu);
    document.getElementById('mp-set-tpse').addEventListener('click', async () => {
      try {
        let fileInput = document.getElementById('mp-select-file');
        let reader = new FileReader();
        if (!fileInput.files[0]) {
          alert(`${mp} Please select a file first`);
          return;
        }
        reader.readAsText(fileInput.files[0]);
        await new Promise((res, rej) => {
          reader.onload = res;
          reader.onerror = rej;
        });
        let json = JSON.parse(reader.result);
        if (json.version != '0.23.8') {
          let confirmation = confirm(
            `${mp} TPSE file is v${json.verson}, but this version of Microplus Toolkit is designed for v0.23.8. ` +
            `Microplus Toolkit does not provide TPSE migration functionality. This TPSE file may break TETR.IO, ` +
            `but if it doesn't work you can always remove it. Use this TPSE file anyway?`
          );
          if (!confirmation) return;
        }

        let invalidProps = new Set(Object.keys(json));
        let validProps = [
          'version', 'skin', 'ghost', 'customSoundAtlas', 'customSounds', 'music',
          ...[...invalidProps].filter(prop => prop.startsWith('song-'))
        ];
        for (let validProp of validProps)
          invalidProps.delete(validProp);
        for (let prop of [...invalidProps])
          delete json[prop];

        GM_setValue('tpse', JSON.stringify(json));

        alert(`${mp} TPSE file set (${invalidProps.size} unsupported keys ignored)`);
        console.log(mp, 'TPSE file set, with removed keys: ', invalidProps);
        window.location.reload();
      } catch(ex) {
        alert(mp + ' Failed to set TPSE file: ' + ex);
        console.error(mp, 'Failed to set TPSE file', ex);
      }
    });
    let removeTPSE = document.getElementById('mp-remove-tpse');
    if (GM_getValue('tpse', null) == null) {
      removeTPSE.disabled = true;
    } else {
      removeTPSE.addEventListener('click', () => {
        console.log(mp, 'TPSE cleared');
        GM_setValue('tpse', null);
        window.location.reload();
      });
    }
  });

  async function waitUntil(predicate, trigger) {
    while (!await predicate()) {
      await new Promise(res => setTimeout(res, 10));
    }
    await trigger();
  }


  if (tpse.skin || tpse.ghost) {
    console.log(mp, "TPSE has mino or ghost skin");
    waitUntil(() => unsafeWindow.DEVHOOK_CONNECTED_SKIN, () => {
      console.log(mp, "Calling DEVHOOK_CONNECTED_SKIN()");
      unsafeWindow.DEVHOOK_CONNECTED_SKIN();
    });

    // Discover calls to `new Image()` to watch and rewrite the src property
    let nativeImage = unsafeWindow.Image;
    unsafeWindow.Image = new Proxy(nativeImage, {
      construct(target, args) {
        let val = new target(...args);
        console.debug(mp, "New image created, waiting for first src assignment...");
        waitUntil(() => val.src != "", async () => {
          console.debug(mp, "First source assignment", val.src);

          // intentionally use no anchors - skins may have query parameters and will have a tetrio domain prefix
          let skinURL = /\/res\/skins\/(minos|ghost)\/connected(\.2x)?\.png/.exec(val.src);
          if (skinURL) {
            console.log(mp, "Redirecting request to", val.src);
            let sourceTex = skinURL[1] == 'minos' ? tpse.skin : tpse.ghost;
            if (skinURL[2] != '.2x') {
              // downscale to 1x texture
              let image = new Image();
              image.src = sourceTex;
              await new Promise(res => { image.onload = res; });
              let canvas = document.createElement('canvas');
              canvas.width = 1024;
              canvas.height = 1024;
              canvas.getContext('2d').drawImage(image, 0, 0, 1024, 1024);
              sourceTex = canvas.toDataURL('image/png');
            }
            val.src = sourceTex;
          }
        });
        return val;
      }
    });
  } else {
    console.log(mp, "TPSE lacks mino or ghost skin");
  }


  if (tpse.customSoundAtlas && tpse.customSounds || tpse.music) {
    console.log(mp, "TPSE contains custom sounds or music");
    // intercept Howler.js to rewrite its arguments
    let howl = unsafeWindow.Howl; // this shouldn't be present yet, but if microplus late-loaded then it'll be populated here
    let musicLoop = 0;
    Object.defineProperty(unsafeWindow, 'Howl', {
      get() {
        return new Proxy(howl, {
          construct(target, args) {
            try {
              console.debug(mp, "new Howl", target, args);

              let howler = null;
              if (tpse.customSounds && tpse.customSoundAtlas && args[0].src[0]?.includes('tetrio.ogg')) {
                console.log(mp, "Rewriting howler arguments for sound effects", args);
                args[0].src = tpse.customSounds;
                args[0].sprite = tpse.customSoundAtlas;
              }

              // todo: ripped from tetrio source, an automated way to read these would be nice
              let baseSongDefs = {
                random: ['kaze-no-sanpomichi','honemi-ni-shimiiru-karasukaze','inorimichite','muscat-to-shiroi-osara','natsuzora-to-syukudai','akindo','yoru-no-niji','akai-tsuchi-wo-funde','burari-tokyo','prism','back-water','burning-heart','hayate-no-sei','ice-eyes','ima-koso','risky-area','fuyu-no-jinkoueisei','hatsuyuki','kansen-gairo','chiheisen-wo-koete','moyase-toushi-yobisamase-tamashii','naraku-heno-abyssmaze','samurai-sword','super-machine-soul','uchuu-5239','ultra-super-heros','21seiki-no-hitobito','haru-wo-machinagara','go-go-go-summer','sasurai-no-hitoritabi','wakana','zange-no-ma','subarashii-nichijou','asphalt','madobe-no-hidamari','minamoto','sora-no-sakura','suiu','freshherb-wreath-wo-genkan-ni'],
                calm: ['kaze-no-sanpomichi','honemi-ni-shimiiru-karasukaze','inorimichite','muscat-to-shiroi-osara','natsuzora-to-syukudai','akindo','yoru-no-niji','akai-tsuchi-wo-funde','burari-tokyo','prism','fuyu-no-jinkoueisei','hatsuyuki','kansen-gairo','21seiki-no-hitobito','haru-wo-machinagara','go-go-go-summer','sasurai-no-hitoritabi','wakana','zange-no-ma','subarashii-nichijou','asphalt','madobe-no-hidamari','minamoto','sora-no-sakura','suiu','freshherb-wreath-wo-genkan-ni'],
                battle: ['back-water','burning-heart','hayate-no-sei','ice-eyes','ima-koso','risky-area','chiheisen-wo-koete','moyase-toushi-yobisamase-tamashii','naraku-heno-abyssmaze','samurai-sword','super-machine-soul','uchuu-5239','ultra-super-heros']
              };
              let match = /res\/bgm\/(.+?).mp3/.exec(args[0].src);
              if (tpse.music && match) {
                console.log(mp, "Beginning music rewrite for music", args[0]);
                let baseSongID = match[1];
                // we aren't rewriting the actual music definition here, so we have to piggyback on whether the song tetrio tried
                // to play is calm or battle music. This'll probably skew the rng a bit, but that shouldn't be much of a problem.
                let pool = baseSongDefs.calm.includes(baseSongID) ? 'calm' : baseSongDefs.battle.includes(baseSongID) ? 'battle' : 'random';
                
                let override = tpse.music.filter(song => song.override == baseSongID)[0];
                let songs = tpse.music.filter(song => song.metadata.genre.toLowerCase() == pool.toLowerCase());
                let song = override || songs[Math.floor(Math.random() * songs.length)];
                console.log(mp, "Rewriting howler arguments for song ID", baseSongID, "with pool", pool, "and custom song", song);
                if (!song) return; // todo: graceful silent fail case, as is this'll start playing base tetrio music
                args[0].src = tpse['song-' + song.id];
                args[0].sprite = {
                  // (if there's no loopLength but loop is true, the whole song is looped)
                  start: [0, song.metadata.loopStart, !song.metadata.loopLength && song.metadata.loop],
                  loop: [song.metadata.loopStart, song.metadata.loopLength, song.metadata.loop]
                };
                // body adapted from tetrio code, which checks against a steadily-incrementing integer to prevent
                // playing the loop segment if the howler has already been stopped. We keep track of our own here instead.
                // tetrio handles stopping the howler, though.
                let thisLoop = ++musicLoop;
                args[0].onload = function() {
                  howler.play('start');
                  // jump into loop segment if there's a loopLength set
                  if (song.metadata.loopLength) {
                    setTimeout(() => {
                      if (thisLoop != musicLoop) return;
                      howler.play('loop');
                    }, song.metadata.loopStart)
                  }
                }
                console.log(mp, "Final howler config", args[0])
              }
              howler = new target(...args);
              return howler;
            } catch(ex) {
              console.error(mp, ex);
              return new target(...args);
            }
          }
        });
      },
      set(val) {
        howl = val;
      }
    });
  } else {
    console.log(mp, "TPSE lacks custom sounds or music");
  }
})();
