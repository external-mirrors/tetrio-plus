export const name = 'TETR.IO v6.1.0 connected';
export const desc = 'A complex 1024x1024 raster image with 48px by 48px blocks (see wiki)';
export const extrainputs = [];

export function test(files) {
  if (files.length != 1) return false;
  if (files[0].type == 'image/gif' || files[0].type == 'image/svg+xml')
    return false;
  return files[0].image.width == 1024 && files[0].image.height == 1024;
}
export async function load(files, storage) {
  await storage.set({ skin: files[0].data });
}
