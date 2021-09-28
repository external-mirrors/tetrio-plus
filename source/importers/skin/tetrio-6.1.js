export const name = 'TETR.IO v6.1.0';
export const desc = 'A 256x256 raster image with 12 blocks (48px by 48px, arranged 6 by 2)';
export const extrainputs = [];

export function convertNewTetrioToConnected(image) {
  const canvas = window.document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const f = 2;
  canvas.width = 1024*f;
  canvas.height = 1024*f;

  let srcBlockSize = image.width * 48 / 256;
  let srcColumns = 5;

  // connected format: https://tetr.io/res/skins/minos/connected.png
  // block size: 48x48, connected textures use 4x6 variants
  for (let block = 0; block < 10; block++) {
    ctx.save();
    let rowsToCopy = 6;
    switch (true) {
      case block < 4: ctx.translate(block*48*f*4, 0); break;
      case block < 8: ctx.translate((block-4)*48*f*4, 48*f*6); break;
      case block == 8: ctx.translate(4*48*f*4, 0); rowsToCopy = 4; break;
      case block == 9: ctx.translate(4*48*f*4, 48*f*4); rowsToCopy = 4; break;
    }
    for (let dx = 0; dx < 4; dx++) {
      for (let dy = 0; dy < rowsToCopy; dy++) {
        let src_x = (block % srcColumns) * srcBlockSize;
        let src_y = Math.floor(block / srcColumns) * srcBlockSize;
        let src_w = srcBlockSize;
        let src_h = srcBlockSize;
        let dest_x = 48*f * dx;
        let dest_y = 48*f * dy;
        let dest_w = 48*f;
        let dest_h = 48*f;
        ctx.drawImage(image,src_x,src_y,src_w,src_h,dest_x,dest_y,dest_w,dest_h);
      }
    }
    ctx.restore();
  }

  return canvas;
}

import { KEYS, Validator } from './util.js';
export function test(files) {
  if (files.length != 1) return false;
  return new Validator(files[0])
    .blockMime('image/gif')
    .blockMime('image/svg+xml')
    .filename(KEYS.UNCONNECTED)
    .dimension(256, 256)
    .isAllowed();
}
import { load as loadconnected } from './tetrio-6.1-connected.js';
export async function load(files, storage) {
  await storage.set({ intermediate: files[0].data });

  let file = files[0];
  let image = convertNewTetrioToConnected(file.image);
  let data = image.toDataURL('image/png');
  await loadconnected([{ ...file, image, data }], storage);
}
