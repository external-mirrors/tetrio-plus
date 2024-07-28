async function getRequiredResolution(storage) {
  let res = await storage.get([
    'skin', 'ghost', 'advancedSkinLoading', 'skinAnimMeta', 'ghostAnimMeta'
  ]);
  if (res.advancedSkinLoading && (res.skinAnimMeta || res.ghostAnimMeta))
    return 'hd';
  if (res.skin || res.ghost)
    return 'uhd';
  return null;
}
createRewriteFilter("UHD/HD forcer", "https://tetr.io/js/tetrio.js*", {
  enabledFor: async (storage, request) => {
    return await getRequiredResolution(storage) != null;
  },
  onStop: async (storage, url, src, callback) => {
    let res = await getRequiredResolution(storage);
    let newSrc = src.replace(/["']uhd["']\s*:\s*["']hd["']/, `'${res}':'${res}'`)
    if (newSrc == src) console.warn('UHD Disabler hook broke (1/1)');
    callback({ type: 'text/javascript', data: newSrc, encoding: 'text' });
  }
});

createRewriteFilter("Scale mode forcer", "https://tetr.io/js/tetrio.js*", {
  enabledFor: async (storage, request) => {
    let res = await storage.get('forceNearestScaling');
    return res.forceNearestScaling;
  },
  onStop: async (storage, url, src, callback) => {
    let newSrc = src.replace(
      /(\w{1,5}=new\s*PIXI\.Application\({)/g,
      `$1__:void (() => { PIXI.settings.SCALE_MODE=PIXI.SCALE_MODES.NEAREST; })(),`
    );
    if (newSrc == src) console.warn('Scale mode forcer hook broke (1/1)');
    callback({ type: 'text/javascript', data: newSrc, encoding: 'text' });
  }
});

createRewriteFilter("Advanced skin loader", "https://tetr.io/js/tetrio.js*", {
  enabledFor: async (storage, request) => {
    let res = await storage.get([
      'advancedSkinLoading',
      'skinAnimMeta',
      'ghostAnimMeta'
    ]);
    return res.advancedSkinLoading && (res.skinAnimMeta || res.ghostAnimMeta);
  },
  onStop: async (storage, url, src, callback) => {
    try {
      const res = await storage.get(['skinAnimMeta', 'ghostAnimMeta']);
      console.log('res', res);

      // Load animated spritesheet
      src = src.replace(
        /(\/res\/skins\/(minos|ghost)\/connected.png)/g,
        "$1?animated"
      );

      src = `
        // one time init to read control events from the music graph
        window.__tetrioPlusAdvSkinLoader = { manualControl: false, frame: 0 };
        document.addEventListener('tetrio-plus-set-skin-manual-control', evt => {
          window.__tetrioPlusAdvSkinLoader.manualControl = evt.detail;
        });
        document.addEventListener('tetrio-plus-set-skin-frame', evt => {
          window.__tetrioPlusAdvSkinLoader.frame = evt.detail;
        });
      ` + src;

      // Set up animated textures
      var rgx = /(\w+\((\w+),\s*(\w+),\s*(\w+),\s*(\w+),\s*(\w+),\s*(\w+)\)\s*{[\S\s]{0,200}Object\.keys\(\3\)\.forEach\(\(\w\s*=>\s*{)([\S\s]+?)}/
      var match = false;
      src = src.replace(rgx, ($, pre, a1, a2, a3, a4, a5, a6, loopBody) => {
        var rgx2 = /(\w+\[\w+\])\s*=\s*new\s*PIXI\.Texture\((\w+),\s*new\s*PIXI.Rectangle\(([^,]+),([^,]+),([^,]+),([^,]+)\)\)/;
        let res2 = rgx2.exec(loopBody);
        if (!res2) return;
        let [$2, target, baseTexArg, rectArg1, rectArg2, rectArg3, rectArg4] = res2;
        loopBody = (`
          let { frames, delay } = ${b64Recode(res.skinAnimMeta || { frames: 0, delay: 1 })};
          let { frames: gframes, delay: gdelay } = ${b64Recode(res.ghostAnimMeta || { frames: 0, delay: 1 })};

          let first = new PIXI.Texture(
            ${baseTexArg},
            new PIXI.Rectangle(${rectArg1}, ${rectArg2}, ${rectArg3}, ${rectArg4})
          );

          let ghost = (
            ${baseTexArg}?.resource?.url &&
            ${baseTexArg}.resource.url.indexOf('ghost') !== -1
          );
          if (ghost) {
            frames = gframes;
            delay = gdelay;
          }
          if (ghost === undefined) {
            frames = 0;
            delay = 1;
            //console.log("TETR.IO PLUS: Unknown skin type, bailing animation.");
          }
          let scale = ghost ? 512 : 1024;

          first.tetrioPlusAnimatedArray = [];
          for (let _i = 0; _i < frames; _i++) {
            first.tetrioPlusIsGhost = ghost;
            first.tetrioPlusAnimatedArray.push(new PIXI.Texture(
              ${baseTexArg},
              new PIXI.Rectangle(
                ${rectArg1} + (_i%16) * scale,
                ${rectArg2} + Math.floor(_i/16) * scale,
                ${rectArg3},
                ${rectArg4}
              )
            ));
          }
          if (first.tetrioPlusAnimatedArray.length == 0)
            first.tetrioPlusAnimatedArray.push(first);

          ${target} = first;
        `);
        match = true;
        return pre + loopBody + '}';
      });
      if (!match) {
        console.warn('Advanced skin loader hooks broke (1/?)');
        return;
      }

      // Replace sprites with animated sprites
      var rgx = /(wang24[\S\s]{0,50}(.)\s*=\s*\w+\.assets\[.+?\].textures[\S\s]{0,50})new PIXI.Sprite\(\2\)/g;
      var match = 0;
      src = src.replace(rgx, ($, pre, texVar) => {
        match += 1;
        return pre + (`
          (() => {
            let { frames, delay } = ${b64Recode(res.skinAnimMeta || {})};
            let { frames: gframes, delay: gdelay } = ${b64Recode(res.ghostAnimMeta || {})};

            if (!${texVar}.tetrioPlusAnimatedArray) // Bail on non-tetrioplus skin
              return new PIXI.AnimatedSprite([${texVar}]);

            let sprite = new PIXI.AnimatedSprite(${texVar}.tetrioPlusAnimatedArray);
            sprite.animationSpeed = 1/delay;

            if (${texVar}.tetrioPlusIsGhost) {
              frames = gframes;
              delay = gdelay;
            }

            let first = true;
            function tickFrame() {
              let targetFrame = window.__tetrioPlusAdvSkinLoader.manualControl
                ? Math.floor(window.__tetrioPlusAdvSkinLoader.frame) % frames
                : ~~(((PIXI.Ticker.shared.lastTime/1000) * 60 / delay) % frames);
              sprite.gotoAndStop(targetFrame);

              if (first || (sprite.parent && sprite.parent.parent))
                requestAnimationFrame(tickFrame);
              first = false;
            }
            tickFrame();
            return sprite;
          })()
        `);
      });
      if (match != 2) {
        console.warn('Advanced skin loader hooks broke (2/?)');
        return;
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
