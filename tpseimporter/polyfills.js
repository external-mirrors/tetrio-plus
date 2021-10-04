import { ReadableStreamBuffer, WritableStreamBuffer } from 'stream-buffers';
import { OfflineAudioContext } from 'web-audio-engine';
import GIFGroover from './lib/GIFGroover.js';
import fetch, { Response } from 'node-fetch';
import { Blob, FileReader } from 'vblob';
import { Canvas, Image } from 'canvas';
import ffmpeg from 'fluent-ffmpeg';
import { Readable } from 'stream';
import path from 'path';
import 'node-fetch';
import fs from 'fs';

global.self = global;
global.OggVorbisEncoderConfig = { TOTAL_MEMORY: 64 * 1024**2 };
global.print = console.error;
let ove = fs.readFileSync(path.join(__dirname, '../source/lib/OggVorbisEncoder.js'));
new Function(ove)();
let jszip = fs.readFileSync(path.join(__dirname, '../source/lib/jszip.min.js'));
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

    Blob,
    FileReader,
    OggVorbisEncoder,
    OfflineAudioContext,
    Image,
    document: {
      createElement(el) {
        if (el != 'canvas') throw new Error('Not supported');
        return new Canvas();
      }
    },
    async fetch(url) {
      if (url instanceof Readable)
        return new Response(url);

      let dataUrl = /^data:.{0,100};base64,/.exec(url);
      if (dataUrl) {
        let buffer = Buffer.from(url.slice(dataUrl[0].length), 'base64');
        return { // mock response
          async text() { return buffer.toString(); },
          async arrayBuffer() { return buffer; }
        }
      }

      return await fetch(url);
    }
  },
  browser: {
    extension: {
      getURL(relpath) {
        return fs.createReadStream(path.join(__dirname, '..', relpath));
      }
    }
  }
});
