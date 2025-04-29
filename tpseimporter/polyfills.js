import { ReadableStreamBuffer, WritableStreamBuffer } from 'stream-buffers';
import { OfflineAudioContext } from 'web-audio-engine';
import GIFGroover from './lib/GIFGroover.js';
import { Canvas, Image } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';

global.self = global;
global.OggVorbisEncoderConfig = { TOTAL_MEMORY: 64 * 1024**2 };
global.print = console.error;
let ove = fs.readFileSync(path.join(fileURLToPath(import.meta.url), '../../source/lib/OggVorbisEncoder.js'));
new Function(ove)();
let jszip = fs.readFileSync(path.join(fileURLToPath(import.meta.url), '../../source/lib/jszip.min.js'));
new Function(jszip)();

// Web API polyfills
Object.assign(global, {
  Blob,
  window: {
    // Not actually polyfills but used to feature-detect & polyfill other stuff
    IS_NODEJS_POLYFILLED: true,
    ffmpeg,
    GIFGroover,
    ReadableStreamBuffer,
    WritableStreamBuffer,

    Blob: global.Blob,
    OggVorbisEncoder,
    OfflineAudioContext,
    Image,
    document: {
      createElement(el) {
        if (el != 'canvas') throw new Error('Not supported');
        return new Canvas();
      }
    },
    fetch: global.fetch
  },
  browser: {
    extension: {
      getURL(relpath) {
        return fs.createReadStream(path.join(__dirname, '..', relpath));
      }
    }
  }
});
