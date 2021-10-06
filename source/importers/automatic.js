import { test as sfxTest, load as sfxLoad } from './sfx/encodeFromFiles.js';
import { test as musicTest, load as musicLoad } from './music.js';
import { populateImage } from '../shared/filehelper.js';
import /* non es6 */ '../shared/tpse-sanitizer.js';
import /* non es6 */ '../lib/jszip.min.js';

export default async function automatic(importers, files, storage, options) {
  if (files.every(file => file.name.endsWith('.zip'))) {
    if (options.zipdepth > 5)
      throw new Error("Refusing to open a zip nested more than 5 layers deep");

    let results = await Promise.all(files.map(async file => {
      let res = await window.fetch(file.data);
      let buffer = await (res.arrayBuffer());
      let zip = await JSZip.loadAsync(buffer);
      let mimes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg',
        'webp': 'image/webp',

        'webm': 'video/webm',

        'mp3': 'audio/mpeg',
        'ogg': 'audio/ogg',
        'wav': 'audio/wav',
      }
      let files = await Promise.all(Object.values(zip.files).map(async file => {
        return populateImage({
          name: file.name,
          type: mimes[file.name.split('.').slice(-1)[0]] || 'application/octet-stream',
          data: 'data:application/octet-stream;base64,' + await file.async('base64')
        })
      }));
      (options&&options.log||(()=>{}))("Importing files from zip " + file.name + "...");
      options.zipdepth = (options.zipdepth || 0) + 1;
      return await automatic(importers, files, storage, options);
    }));
    return { type: 'multi', results };
  }
  if (files.every(file => file.name.endsWith('.tpse'))) {
    (options&&options.log||(()=>{}))("Guessing import type TPSE");
    for (let file of files) {
      let json = JSON.parse(await (await window.fetch(file.data)).text());
      await window.sanitizeAndLoadTPSE(json, storage);
    }
    return { type: 'tpse' };
  }
  if (files.every(file => /^image/.test(file.type))) {
    (options&&options.log||(()=>{}))("Guessing import type skin");
    return await importers.skin.automatic(files, storage, options);
  }
  if (await sfxTest(files)) {
    (options&&options.log||(()=>{}))("Guessing import type sfx");
    return await sfxLoad(files, storage, options);
  }
  if (await musicTest(files)) {
    (options&&options.log||(()=>{}))("Guessing import type music");
    return await musicLoad(files, storage, options);
  }
  // TODO: backgrounds
  throw new Error("Unable to determine import type");
}
