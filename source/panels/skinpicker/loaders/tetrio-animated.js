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

export async function splitgif(file) {
  const gif = GIFGroover();
  gif.playOnLoad = false;
  gif.src = file.data;
  let evt = await new Promise(res => gif.onload = res);

  if (!app.overrideFPS) {
    let fps = ((gif.duration / gif.frameCount) / 1000) * 60;
    app.delay = fps;
  }

  let canvas = document.createElement('canvas');
  canvas.width = gif.naturalWidth;
  canvas.height = gif.naturalHeight;
  let ctx = canvas.getContext('2d');

  let frames = [];
  for (let i = 0; i < gif.frameCount; i++) {
    if (!app.combine)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(gif.getFrame(i), 0, 0);

    let image = document.createElement('canvas');
    image.width = canvas.width;
    image.height = canvas.height;
    image.getContext('2d').drawImage(canvas, 0, 0);
    let data = image.toDataURL('image/png');
    frames.push({ ...file, type: 'image/png', image, data });
  }
  return frames;
}

import { load as loadraster } from './tetrio-raster.js';
export async function load(files) {
  if (files.length == 1 && files[0].type == 'image/gif')
    files = await splitgif(files[0]);

  let canvas = document.createElement('canvas');
  let step = files[0].image.height;
  canvas.width = files[0].image.width;
  canvas.height = step * files.length;
  let ctx = canvas.getContext('2d');

  for (let i = 0; i < files.length; i++) {
    ctx.drawImage(files[i].image, 0, i * step, canvas.width, step);
  }

  console.log("Frames", files);
  await loadraster([files[0]]); // populate normal skins too
  await browser.storage.local.set({
    skinAnim: canvas.toDataURL('image/png'),
    skinAnimMeta: {
      frames: files.length,
      frameWidth: canvas.width,
      frameHeight: step,
      delay: app.delay
    }
  });
}
