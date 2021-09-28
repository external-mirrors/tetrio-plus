export const name = 'Tetrio png/jpg';
export const desc = 'A raster image at a 12.4 aspect ratio with 12 blocks';
export const extrainputs = [];

export const SKIN  = [256, 256, [0, 1, 2, 3, 4, 5, 6, /*skip ghost */ 8, 9, 10 /*skip topout*/]];
export const GHOST = [128, 128, [7, 11]];
export function convertOldTetrioToNewTetrio(image, width, height, sourceRemap) {
  const canvas = window.document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = width;
  canvas.height = height;
  // Tetrio format: https://tetr.io/res/skins/minos/tetrio.png
  // New format doesn't include ghost or topout indicators
  for (let block = 0; block < sourceRemap.length; block++) {
    let src_x = sourceRemap[block] * image.width / 12;
    let src_y = 0;
    let src_w = image.width / 12.4;
    let src_h = image.height;
    let dest_x = 48 * (block % 5);
    let dest_y = 48 * Math.floor(block / 5);
    let dest_w = 48;
    let dest_h = 48;
    ctx.drawImage(image,src_x,src_y,src_w,src_h,dest_x,dest_y,dest_w,dest_h);
  }
  return canvas;
}

export function test(files) {
  if (files.length != 1) return false;
  if (files[0].type == 'image/gif' || files[0].type == 'image/svg+xml')
    return false;
  let aspect = files[0].image.width / files[0].image.height;
  return aspect == 12.4;
}
import { load as loadtetrio61 } from './tetrio-6.1.js';
import { load as loadtetrio61ghost } from './tetrio-6.1-ghost.js';
export async function load(files, storage) {
  let file = files[0];

  let image = convertOldTetrioToNewTetrio(file.image, ...SKIN);
  let data = image.toDataURL('image/png');

  let ghostimage = convertOldTetrioToNewTetrio(file.image, ...GHOST);
  let ghostdata = ghostimage.toDataURL('image/png');

  await loadtetrio61([{ ...file, image, data }], storage);
  await loadtetrio61ghost([{ ...file, image: ghostimage, data: ghostdata }], storage);
}
