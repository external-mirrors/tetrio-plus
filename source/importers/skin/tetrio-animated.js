export const name = 'Tetrio animated';
export const desc = 'Multiple PNGs or a gif at a 12.4 aspect ratio with 12 blocks';
export const extrainputs = ['delay'];

export function test(files) {
  if (files.length == 1 && files[0].type != 'image/gif')
    return false;

  return files.every(file => {
    let aspect = file.image.width / file.image.height;
    return aspect == 12.4;
  });
}

import splitgif from './converters/splitgif.js';
import { load as loadraster } from './tetrio-raster.js';
export async function load(files, storage, options) {
  if (files.length == 1 && files[0].type == 'image/gif')
    files = await splitgif(files[0], options);

  let canvas = window.document.createElement('canvas');
  let step = files[0].image.height;
  canvas.width = files[0].image.width;
  canvas.height = step * files.length;
  let ctx = canvas.getContext('2d');

  for (let i = 0; i < files.length; i++) {
    ctx.drawImage(files[i].image, 0, i * step, canvas.width, step);
  }

  console.error(options);

  await loadraster([files[0]], storage); // populate normal skins too
  // TODO: fix this
  // await storage.set({
  //   skinAnim: canvas.toDataURL('image/png'),
  //   skinAnimMeta: {
  //     frames: files.length,
  //     frameWidth: canvas.width,
  //     frameHeight: step,
  //     delay: options.delay || 30
  //   }
  // });
}
