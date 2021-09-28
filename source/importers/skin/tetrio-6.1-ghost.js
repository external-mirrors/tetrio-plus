export const name = 'TETR.IO v6.1.0 ghost';
export const desc = 'A 128x128 raster image with 2 blocks for ghost and topout pieces (48px by 48px, arranged 2 by 1)';
export const extrainputs = [];

export function convertNewTetrioGhostToConnectedGhost(image) {
  const canvas = window.document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const f = 2;
  canvas.width = 512*f;
  canvas.height = 512*f;

  let srcBlockSize = image.width * 48 / 128;

  // connected format: https://tetr.io/res/skins/ghost/connected.png
  // source format: https://tetr.io/res/skins/ghost/tetrio.png
  // block size: 48x48, connected textures use 4x6 variants
  for (let block = 0; block < 2; block++) {
    ctx.save();

    ctx.translate(block*48*f*4, 0);
    for (let dx = 0; dx < 4; dx++) {
      for (let dy = 0; dy < 6; dy++) {
        let src_x = block * srcBlockSize;
        let src_y = 0;
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
    .filename(KEYS.UNCONNECTED_GHOST)
    .dimension(128, 128)
    .isAllowed();
}
import { load as loadconnectedghost } from './tetrio-6.1-connected-ghost.js';
export async function load(files, storage) {
  await storage.set({ intermediate2: files[0].data });

  let file = files[0];
  let image = convertNewTetrioGhostToConnectedGhost(file.image);
  let data = image.toDataURL('image/png');
  await loadconnectedghost([{ ...file, image, data }], storage);
}
