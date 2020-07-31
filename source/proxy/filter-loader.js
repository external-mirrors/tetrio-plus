const manifest = require('../../desktop-manifest.js');
const b64Recode = require('../lib/base64-recoder');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const tpse = JSON.parse(fs.readFileSync('./proxy-settings.tpse', 'utf8'));
// const tpse = { debugBreakTheGame: true };
// tpse.bypassBoostrapper = false;
const dataSource = {
  async get(key) { return tpse; },
  async set() { throw new Error('Not implemented'); }
}

const filters = [];
let ctx = vm.createContext({
  createRewriteFilter(name, url, options) {
    // console.log('createRewriteFilter', name, url, Object.keys(options))
    filters.push({ name, url, options });
  }
});
for (let script of manifest.browser_specific_settings.proxy_client.scripts) {
  let code = fs.readFileSync(script, 'utf8');
  // console.log('--', script, '--');
  vm.runInContext(code, ctx);
}

// This is stupid, but it works.
let evalCtx = '';
function appendCode(name, code) {
  let safeishName = JSON.stringify(name);
  evalCtx += `try { ${code} } catch(ex) { console.error(${safeishName}, ex) };`;
}
appendCode('tpse file', 'var tpse = ' + JSON.stringify(tpse));
for (let inject of manifest.browser_specific_settings.proxy_client.preload_scripts) {
  appendCode(inject, fs.readFileSync(inject, 'utf8'));
}
filters.push({
  name: 'Proxy content script injector',
  url: 'https://tetr.io/js/tetrio.js',
  options: {
    async enabledFor() { return true },
    async onStop(storage, url, src, callback) {
      callback({
        type: 'text/javascript',
        data: src + ';\n\n\n/* Tetrio Plus code */\n' + evalCtx,
        encoding: 'text'
      });
    }
  }
});

let css = '';
for (let inject of manifest.browser_specific_settings.proxy_client.inject_css) {
  css += `\n/* ${inject} */\n` + fs.readFileSync(inject, 'utf8');
}
filters.push({
  name: 'Proxy css injector',
  url: 'https://tetr.io/css/tetrio.css',
  options: {
    async enabledFor() { return true },
    async onStop(storage, url, src, callback) {
      callback({
        type: 'text/javascript',
        data: src + css,
        encoding: 'text'
      });
    }
  }
});

function matchesGlob(glob, string) {
  return new RegExp(
    '^' +
    glob
      .split('*')
      .map(seg => seg.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
      .join('.+') +
    '$'
  ).test(string);
}

module.exports = async function applyFilters(url, bodyPromise) {
  let data = null;
  function filterCallback(response) {
    let { type, data: newData, encoding } = response;
    if (type) contentType = type;

    switch(encoding || 'text') {
      case 'text':
        data = newData;
        break;

      case 'base64-data-url':
        data = Buffer.from(newData.split('base64,')[1], 'base64');
        console.log("Rewrote b64 data url to", data);
        break;

      default:
        throw new Error('Unknown encoding');
    }
  };

  for (let filter of filters) {
    if (!matchesGlob(filter.url, url))
      continue;

    console.log("Testing filter", filter.name);
    if (!await filter.options.enabledFor(dataSource, filter.url))
      continue;

    if (filter.options.onStart) {
      // If data is a Buffer, it has a 'buffer' property which is an
      // Uint8Array-like. Offer that for browser compatibility.
      console.log("Start-handling it!", filter.name);
      await filter.options.onStart(
        dataSource,
        url,
        (data && data.buffer) || data,
        filterCallback
      );
    }

    if (filter.options.onStop) {
      // load default body if no data is generated yet
      if (!data) data = await bodyPromise;
      console.log("Stop-handling it!", filter.name);
      await filter.options.onStop(
        dataSource,
        url,
        data.buffer || data,
        filterCallback
      );
    }
  }

  if (!data) data = await bodyPromise; // No filters?
  return data;
}
