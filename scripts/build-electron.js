#!node
// To be used by pack-electron.sh
const fs = require('fs');
const crypto = require('crypto');

const manifest = require('../desktop-manifest.js');
const vanillaHash = manifest.browser_specific_settings.desktop_client.vanilla_hash;

const hash = crypto.createHash('sha1');
hash.setEncoding('hex');
hash.write(fs.readFileSync('app.asar'));
hash.end();
const actualHash = hash.read();

if (actualHash.toLowerCase() != vanillaHash.toLowerCase()) {
  console.error("TETR.IO app.asar hash does not match");
  console.error("TETR.IO Desktop was probably updated");
  console.log("Expected:", vanillaHash);
  console.log("Got:", actualHash);
  process.exit(1);
}

let main = fs.readFileSync('out/main.js');
let preload = fs.readFileSync('out/preload.js');

fs.writeFileSync(
  'out/main.js',
  fs.readFileSync('out/main.js', 'utf8').replace(
    /^/,
`const {
  onMainWindow,
  modifyWindowSettings,
  handleWindowOpen
} = require('./tetrioplus/source/electron/electron-main');
`
  ).replace(
    /(new BrowserWindow\()({[\S\s]+?})(\))/,
    '$1modifyWindowSettings($2)$3'
  ).replace(
    /(if \(mainWindow)/g,
    '$1 && !handleWindowOpen(typeof url !== "undefined" ? url : arg)'
  ).replace(
    /(mainWindow = win;)/,
    '$1 onMainWindow(mainWindow);'
  ).replace(
    /Report this to osk\./g,
    `Note: TETR.IO PLUS is installed. Do not report issues to osk/TETR.IO while using TETR.IO PLUS.`
  )
);

fs.writeFileSync(
  'out/preload.js',
  fs.readFileSync('out/preload.js', 'utf8') +
  "\nrequire('./tetrioplus/source/electron/preload');"
);
