export const name = 'TETR.IO v6.1.0 connected ghost';
export const desc = 'A complex 512x512 raster image with 48px by 48px blocks for ghost and topout pieces (see wiki)';
export const extrainputs = [];

export function test(files) {
  if (files.length != 1) return false;
  if (files[0].type == 'image/gif' || files[0].type == 'image/svg+xml')
    return false;
  return files[0].image.width == 512 && files[0].image.height == 512;
}
export async function load(files, storage) {
  await storage.set({ ghost: files[0].data });
}
