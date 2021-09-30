export const name = 'TETR.IO v6.1.0 connected animated';
export const desc = 'A complex 1024x1024 gif or multiple images with 48px by 48px blocks (see wiki)';
export const extrainputs = ['delay'];

import { KEYS, Validator } from './util.js';
export function test(files) {
  if (files.length == 1 && files[0].type != 'image/gif')
    return false;

  return files.every(file => {
    return new Validator(file)
      .filename(KEYS.CONNECTED)
      .dimension(1024, 1024)
      .isAllowed();
  });
}

import splitgif from './converters/splitgif.js';
import { load as loadconnraster } from './tetrio-6.1-connected.js';
export async function load(files, storage, options) {
  if (files.length == 1 && files[0].type == 'image/gif')
    files = await splitgif(files[0], options);

  let canvas = window.document.createElement('canvas');
  canvas.width = 1024 * Math.min(16, files.length);
  canvas.height = 1024 * Math.ceil(files.length/16);
  let ctx = canvas.getContext('2d');

  for (let i = 0; i < files.length; i++)
    ctx.drawImage(files[i].image, i%16 * 1024, Math.floor(i/16) * 1024, 1024, 1024);

  await loadconnraster([files[0]], storage); // non-animated fallback
  await storage.set({
    skinAnim: canvas.toDataURL('image/png'),
    skinAnimMeta: {
      frames: files.length,
      delay: options.delay || 30
    }
  });
}
