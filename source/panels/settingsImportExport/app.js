import '../../shared/drop-handler.js';
import /* non es6 */ '../../shared/migrate.js';
import init, * as tpsecore from '../../lib/tpsecore.js';
import importer from '../../importers/import.js';
import readfiles from '../../shared/filehelper.js';

(async () => {
  await init();

  let match = /install=([^=]+)/.exec(new URL(window.location).search);
  if (match) {
    console.log(match);
    let url = decodeURIComponent(match[1]);

    for (let el of document.querySelectorAll("fieldset:not(#url-importer)"))
      el.style.display = 'none';

    let a = document.getElementById('url-anchor');
    a.href = url;
    a.innerText = url;

    document.getElementById('url-importer').style.display = 'block';
    document.getElementById('import-from-url').addEventListener('click', async () => {
      console.log('Installing ' + url);
      let status = document.createElement('div');
      status.innerText = 'working on import...';
      document.body.appendChild(status);

      try {
        let data = await (await fetch(url)).json();
        alert(await sanitizeAndLoadTPSE(data, browser.storage.local));
      } catch(ex) {
        alert("Failed to load content pack! See the console for more details");
        console.error("Failed to load content pack: ", ex);
        console.error(
          "If your content pack is more than a few hundred megabytes, the " +
          "parser may be running out of memory."
        );
      } finally {
        status.remove();
      }
    });
  }

  document.getElementById('import').addEventListener('change', async evt => {
    let status = document.createElement('div');
    status.innerText = 'working on import...';
    document.body.appendChild(status);

    var reader = new FileReader();
    reader.readAsText(evt.target.files[0], "UTF-8");
    reader.onerror = () => alert("Failed to load content pack");

    try {
      let result = await new Promise(res => {
        reader.onload = evt => res(evt.target.result);
      });
      const data = JSON.parse(result);
      alert(await sanitizeAndLoadTPSE(data, browser.storage.local));
    } catch(ex) {
      alert("Failed to load content pack! See the console for more details");
      console.error("Failed to load content pack: ", ex);
      console.error(
        "If your content pack is more than a few hundred megabytes, the " +
        "parser may be running out of memory."
      );
    } finally {
      // reset the handler
      evt.target.type = '';
      evt.target.type = 'file';
      status.remove();
    }
  });

  document.getElementById('export').addEventListener('click', async evt => {
    try {
      let status = document.createElement('div');
      status.innerText = 'working on export...';
      document.body.appendChild(status);

      let exportKeys = [];
      let elems = document.getElementsByClassName('export-toggle');
      for (let elem of elems) {
        if (elem.checked) {
          exportKeys.push(...elem.getAttribute('data-export').split(','));
        }
      }

      let config = await browser.storage.local.get(exportKeys);
      if (!config.version)
        throw new Error("Attempted to export, but missing key 'version'?");

      if (config.animatedBackground) {
        let key = 'background-' + config.animatedBackground.id;
        Object.assign(config, await browser.storage.local.get(key));
      }

      if (config.backgrounds) {
        let bgIds = config.backgrounds.map(({ id }) => 'background-' + id);
        let bgs = await browser.storage.local.get(bgIds);
        Object.assign(config, bgs);
      }

      if (config.music) {
        let musicIds = config.music.map(({ id }) => 'song-' + id);
        let songs = await browser.storage.local.get(musicIds);
        Object.assign(config, songs);
      }

      console.log("Encoding data...");
      let json = JSON.stringify(config, null, 2);
      let blob = new Blob([json], { type: 'application/json' });

      console.log("Offering download...");
      // https://stackoverflow.com/questions/3665115/18197341#18197341
      let a = document.createElement('a');
      a.setAttribute('href', URL.createObjectURL(blob));
      a.setAttribute('download', 'tetrio-plus-settings-export.tpse');
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      status.remove();
    } catch(ex) {
      alert(ex.toString());
      console.error(ex);
    }
  });

  document.getElementById('clearData').addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all your TETR.IO PLUS data?')) {
      await browser.storage.local.clear();
      await migrate(browser.storage.local);
      await browser.storage.local.set({
        version: browser.runtime.getManifest().version
      });
      alert('Data cleared');
    }
  });

  document.getElementById('import-anything').addEventListener('change', async (evt) => {
    let useExperimental = document.getElementById('use-experimental').checked;
    let status = document.getElementById('import-anything-status');
    status.innerText = "Working...";
    await new Promise(res => setTimeout(res, 50));

    let logs = [];
    try {
      let importer = useExperimental ? tpsecoreImport : classicImport;
      await importer(evt.target, logs);
      alert(`Import successful!\n\nImport logs:\n${logs.join('\n')}`);
      status.innerText = "Import successful";
    } catch(ex) {
      alert(`Import failed: ${ex}!\n\nImport logs:\n${logs.join('\n')}`);
      status.innerText = "Import failed";
      console.error(ex);
    }
  });

  async function classicImport(input, logs) {
    await importer.automatic(
      await readfiles(input),
      browser.storage.local,
      { log(...msg) {
        console.log(msg.join(' '));
        logs.push(msg.join(' '));
      } }
    );
  }

  async function tpsecoreImport(input, logs) {
    let advancedMergeLogic = document.getElementById('advanced-merge-logic').checked;

    let reader = new FileReader();
    let filename = input.files[0].name;
    reader.readAsArrayBuffer(input.files[0], "UTF-8");
    reader.onerror = () => alert("Failed to load content pack");
    let buffer = await new Promise(res => {
      reader.onload = evt => res(new Uint8Array(reader.result));
    });
    console.log(buffer);

    function logger(lvl, msg) {
      console.log("import", lvl, msg);
      if (lvl == 'TRACE' || lvl == 'DEBUG') return;
      let ctx = "";
      let submsg = msg;
      if (msg.startsWith('[')) {
        let braces = 0;
        do {
          if (submsg[0] == '[') braces++;
          if (submsg[0] == ']') braces--;
          ctx += submsg[0];
          submsg = submsg.slice(1);
        } while (braces > 0 && submsg.length > 0);
      }
      logs.push(`[${lvl}] Import: ${submsg}\n  context: ${ctx}`);
    }

    let tpse = tpsecore.create_tpse();
    logs.push("Importing " + filename);
    tpsecore.import_file(tpse, { type: 'automatic' }, filename, buffer, logger);

    if (advancedMergeLogic) {
      logs.push("Re-importing existing content for advanced merge...");
      let all = await browser.storage.local.get();
      let all_enc = new TextEncoder('utf8').encode(JSON.stringify(all));
      tpsecore.import_file(tpse, { type: 'automatic' }, 'current.tpse', all_enc, logger);
    }

    logs.push("Applying generated TPSE...");
    let new_tpse = tpsecore.export_tpse(tpse);

    await browser.storage.local.set(JSON.parse(new_tpse));
    tpsecore.drop_tpse(tpse);
  }

  const sampleRate = 44100;
  const channels = 2;
  const quality = 1.0;
  document.getElementById('decompileSfx').addEventListener('click', async () => {
    let { customSoundAtlas, customSounds } = await browser.storage.local.get([
      'customSoundAtlas', 'customSounds'
    ]);
    if (!customSoundAtlas || !customSounds) {
      alert('No custom sfx configured.');
      return;
    }
    let status = document.createElement('div');
    status.innerText = 'working on export...';
    document.body.appendChild(status);


    const soundBuffer = await new window.OfflineAudioContext(
      channels,
      sampleRate,
      sampleRate
    ).decodeAudioData(await (await fetch(customSounds)).arrayBuffer());

    let zip = new JSZip();
    for (let [name, [ offset, duration ]] of Object.entries(customSoundAtlas)) {
      status.innerText = `working on export: ${name}.ogg...`;
      // Convert milliseconds to seconds
      offset /= 1000; duration /= 1000;

      const ctx = new window.OfflineAudioContext(
        channels,
        sampleRate*duration,
        sampleRate
      );

      let source = ctx.createBufferSource();
      source.buffer = soundBuffer;
      source.connect(ctx.destination);
      source.start(0, offset, duration);
      let slicedBuffer = await ctx.startRendering();

      let encoder = new window.OggVorbisEncoder(sampleRate, channels, quality);
      encoder.encode([
        slicedBuffer.getChannelData(0),
        slicedBuffer.getChannelData(1)
      ]);
      let blob = encoder.finish();
      zip.file(name + '.ogg', blob);
    }

    status.innerText = `working on export: generating zipfile...`;
    let blob = await zip.generateAsync({ type: 'blob' });

    let a = document.createElement('a');
    a.setAttribute('href', URL.createObjectURL(blob));
    a.setAttribute('download', 'tetrio-plus-sfx-export.zip');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    status.remove();
  });

  let oaiw = document.getElementById('open-auto-import-wiki');
  oaiw.href = 'https://gitlab.com/UniQMG/tetrio-plus/-/wikis/automatic-imports';
  oaiw.addEventListener('click', evt => {
    evt.preventDefault();
    window.open('https://gitlab.com/UniQMG/tetrio-plus/-/wikis/automatic-imports');
  });
})();
