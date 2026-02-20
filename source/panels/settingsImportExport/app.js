import '../../shared/drop-handler.js';
import /* non es6 */ '../../shared/migrate.js';
import importer from '../../importers/import.js';
import readfiles from '../../shared/filehelper.js';

(async () => {
  let panic_reported = false;
  let async_runtime_interval = null;
  let tpse_import_handlers = new Map();
  const wasm = await WebAssembly.instantiateStreaming(fetch('../../lib/tpsecore.wasm'), {
    tpsecore: {
      async fetch_asset(asset_id) {
        console.log("fetch_asset", asset_id);
        let asset = null;
        switch(asset_id) {
          case 0: asset = 'https://tetr.io/js/tetrio.js?bypass-tetrio-plus'; break;
          case 1: asset = 'https://tetr.io/sfx/tetrio.opus.rsd?bypass-tetrio-plus'; break;
          case 2: throw new Error("unknown asset #" + asset_id);
        }
        try {
          let body = new Uint8Array(await fetch(asset).then(res => res.arrayBuffer()));
          console.log("fetch_asset", asset_id, "done, got", body.length, "bytes");
          let ptr = tpsecore.allocate_buffer(body.length);
          new Uint8Array(tpsecore.memory.buffer, ptr, body.length).set(body);
          console.log("asset marked provided");
          tpsecore.provide_asset(asset_id, ptr);
        } catch(ex) {
          console.error("fetch_asset", asset_id, "failed:", ex);
          tpsecore.provide_asset(asset_id, 0);
        }
      },
      report_import_done(tpse, status) {
        console.log("import", tpse, "done with status", status);
        tpse_import_handlers.get(tpse)?.finish(status);
        tpse_import_handlers.delete(tpse);
      },
      async set_runtime_sleeping(sleeping) {
        console.log(`set_runtime_sleeping`, sleeping);
        clearInterval(async_runtime_interval);
        if (!sleeping) {
          async_runtime_interval = setInterval(() => {
            console.log("tick");
            tpsecore.tick_async();
          }, 10);
        }
      },
      log(level, ptr, len) {
        let msg = new TextDecoder('utf-8').decode(new Uint8Array(tpsecore.memory.buffer, ptr, len));
        log(level, null, msg);
      },
      import_log(level, tpse, ptr, len) {
        let msg = new TextDecoder('utf-8').decode(new Uint8Array(tpsecore.memory.buffer, ptr, len));
        tpse_import_handlers.get(tpse)?.log(level, msg);
        log(level, tpse, msg);
      },
      report_panic() {
        if (panic_reported) return;
        panic_reported = true;
        alert("Something went catastrophically wrong with tpsecore. See console for details. Reload page before attempting to use tpsecore again.")
        console.trace("tpsecore panic");
      }
    }
  });
  const tpsecore = wasm.instance.exports;
  window.tpsecore_debug = { wasm, tpsecore };

  function log(level, tpse, msg) {
    let t = Date.now();
    switch (level) {
      case 1: console.error("wasm>", { t, tpse }, msg); break;
      case 2: console.warn ("wasm>", { t, tpse }, msg); break;
      case 3: console.info ("wasm>", { t, tpse }, msg); break;
      case 4: console.debug("wasm>", { t, tpse }, msg); break;
      case 5: console.debug("wasm>", { t, tpse }, msg); break;
      default: console.log ("wasm>", { t, tpse }, msg); break;
    }
  }

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

    try {
      let data = null;
      if (evt.target.files[0].name.endsWith('tpsez')) {
        status.innerText = 'working on import: load tpsez...';
        let zip = await JSZip.loadAsync(evt.target.files[0]);
        data = {};
        for (let [key, file] of Object.entries(zip.files)) {
          data[key] = JSON.parse(await file.async('string'))
        }
      } else {
        status.innerText = 'working on import: load tpse...';
        let reader = new FileReader();
        reader.readAsText(evt.target.files[0], "UTF-8");
        reader.onerror = () => alert("Failed to load content pack");
        await new Promise(res => reader.onload = res);
        data = JSON.parse(reader.result);
      }

      status.innerText = 'working on import: apply settings...';
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


  async function exportKeys(entryCallback) {
    let presentKeys = new Set();
    async function exportKey(key) {
      let value = await browser.storage.local.get(key);
      if (!value[key]) return false;
      entryCallback(key, value[key]);
      presentKeys.add(key);
      return true;
    }

    if (!await exportKey('version'))
      throw new Error("Attempted to export, but missing key 'version'?");

    let elems = document.getElementsByClassName('export-toggle');
    for (let elem of elems) {
      if (elem.checked) {
        for (let key of elem.getAttribute('data-export').split(',')) {
          await exportKey(key);
        }
      }
    }

    if (presentKeys.has('animatedBackground')) {
      let { animatedBackground } = await browser.storage.local.get('animatedBackground');
      let key = 'background-' + animatedBackground.id;
      await exportKey(key);
    }

    if (presentKeys.has('backgrounds')) {
      let { backgrounds } = await browser.storage.local.get('backgrounds');
      let bgIds = backgrounds.map(({ id }) => 'background-' + id);
      for (let id of bgIds) await exportKey(id);
    }

    if (presentKeys.has('music')) {
      let { music } = await browser.storage.local.get('music');
      let musicIds = music.map(({ id }) => 'song-' + id);
      for (let id of musicIds) await exportKey(id);
    }
  }
  function offerDownload(filename, blob) {
      console.log("Offering download...");

      // https://stackoverflow.com/questions/3665115/18197341#18197341
      let a = document.createElement('a');
      let url = URL.createObjectURL(blob);
      a.setAttribute('href', url);
      a.setAttribute('download', filename);
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
  }
  document.getElementById('export').addEventListener('click', async evt => {
    let status = document.createElement('div');
    status.innerText = 'working on export...';
    document.body.appendChild(status);
    try {
      let config = {};
      await exportKeys((key, value) => config[key] = value);

      console.log("Encoding data...");
      let json = JSON.stringify(config, null, 2);
      let blob = new Blob([json], { type: 'application/json' });

      offerDownload('tetrio-plus-settings-export.tpse', blob);
      status.remove();
    } catch(ex) {
      alert(ex.toString());
      console.error(ex);
      status.remove();
    }
  });
  document.getElementById('export-zip').addEventListener('click', async evt => {
    let status = document.createElement('div');
    status.innerText = 'working on export...';
    document.body.appendChild(status);
    try {
      let zip = new JSZip();
      let config = {};
      await exportKeys((key, value) => {
        status.innerText = `working on export: key '${key}'...`;
        zip.file(key, JSON.stringify(value));
      });

      status.innerText = `working on export: generating zip (may take a while)...`;
      let zipstart = Date.now();
      let blob = await zip.generateAsync({
        type: "blob",
        // compression: "DEFLATE",
        // compressionOptions: { level: 1 }
      });
      console.log(`Zipping took ${Date.now() - zipstart}ms`);

      status.innerText = `working on export: offering download...`;
      offerDownload('tetrio-plus-settings-export.tpsez', blob);
      status.remove();
    } catch(ex) {
      alert(ex.toString());
      console.error(ex);
      status.remove();
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
    let start = Date.now();

    let logs = [];
    try {
      let importer = useExperimental ? tpsecoreImport : classicImport;
      await importer(evt.target, logs);
      alert(`Import successful! (took ${Date.now() - start}ms)\n\nImport logs:\n${logs.join('\n')}`);
      status.innerText = "Import successful";
    } catch(ex) {
      alert(`Import failed: ${ex} (took ${Date.now() - start}ms)\n\nImport logs:\n${logs.join('\n')}`);
      status.innerText = "Import failed";
      console.error(ex);
    } finally {
      // reset the handler
      evt.target.type = '';
      evt.target.type = 'file';
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
    let tpse = tpsecore.allocate_tpse();
    
    function assert_eq(a, b, label) {
      if (a != b) throw new Error(`assertion at ${label} failed: ${a} != ${b}`);
    }
    
    let advancedMergeLogic = document.getElementById('advanced-merge-logic').checked;
    if (advancedMergeLogic) {
      logs.push("Re-importing existing content for advanced merge...");
      let all = await browser.storage.local.get();
      let all_enc = new TextEncoder('utf8').encode(JSON.stringify(all));
      
      let encoded = new TextEncoder().encode("existing.tpse");
      let fptr = tpsecore.allocate_buffer(encoded.length);
      let fbuffer = new Uint8Array(tpsecore.memory.buffer, fptr, encoded.length);
      console.log(fptr, fbuffer, encoded);
      fbuffer.set(encoded);
      
      let cptr = tpsecore.allocate_buffer(all_enc.length);
      let cbuffer = new Uint8Array(tpsecore.memory.buffer, cptr, all_enc.length);
      cbuffer.set(all_enc);
      
      let p = new Promise(res => tpse_import_handlers.set(tpse, { finish: res, log: () => {} }));
      assert_eq(0, tpsecore.stage_file(tpse, fptr, cptr), 'reimport stage file');
      assert_eq(0, tpsecore.queue_import(tpse), 'reimport queue import');
      assert_eq(0, tpsecore.clear_staged_files(tpse, true), "reimport clear staged files");
      assert_eq(0, await p, 'reimport import');
    }
    
    logs.push("Loading files...");
    console.log("Loading files...", Date.now());
    let reader = new FileReader();
    let filename = input.files[0].name;
    reader.readAsArrayBuffer(input.files[0], "UTF-8");
    reader.onerror = () => alert("Failed to load content pack");
    let content = await new Promise(res => {
      reader.onload = _evt => res(new Uint8Array(reader.result));
    });
    console.log(content);
    
    let encoded = new TextEncoder().encode(filename);
    let fptr = tpsecore.allocate_buffer(encoded.length);
    let fbuffer = new Uint8Array(tpsecore.memory.buffer, fptr, encoded.length);
    fbuffer.set(encoded);
    
    let cptr = tpsecore.allocate_buffer(content.length);
    let cbuffer = new Uint8Array(tpsecore.memory.buffer, cptr, content.length);
    cbuffer.set(content);
    
    logs.push("Running import...");
    console.log("Running import...", Date.now());
    let queue_import = new Promise(res => tpse_import_handlers.set(tpse, {
      finish: res,
      log: (_level, message) => {
        logs.push(message);
      }
    }));
    assert_eq(0, tpsecore.stage_file(tpse, fptr, cptr), 'stage file');
    assert_eq(0, tpsecore.queue_import(tpse), 'queue import');
    let queue_import_result = await queue_import;
    console.log('run_import code', queue_import_result);
    assert_eq(0, tpsecore.clear_staged_files(tpse, true), "clear staged files");
    
    let ptr = tpsecore.export_tpse(tpse);
    let len = tpsecore.get_buffer_length(ptr);
    assert_eq(0, tpsecore.deallocate_tpse(tpse, true));
    try {
      switch (queue_import_result) {
        case 0: break;
        case 1: throw new Error("general error (see logs)");
        case 2: throw new Error("internal error (invalid tpse handle)");
        default: throw new Error("unknown error " + queue_import_result);
      }
      
      logs.push("Applying generated TPSE...");
      console.log("Applying generated TPSE...", Date.now());
      let buffer = new Uint8Array(tpsecore.memory.buffer, ptr, len);
      let json = new TextDecoder('utf-8').decode(buffer);
      let data = JSON.parse(json);
      await browser.storage.local.set(data);
    } finally {
      assert_eq(0, tpsecore.deallocate_buffer(ptr));
    }
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
    if (window.openInBrowser) { // electron
      window.openInBrowser('https://gitlab.com/UniQMG/tetrio-plus/-/wikis/automatic-imports');
    } else {
      window.open('https://gitlab.com/UniQMG/tetrio-plus/-/wikis/automatic-imports');
    }
  });
})();
