const sampleRate = 44100;
const channels = 2;

export async function decodeAudio(buffer, status=(()=>{})) {
  if (window.IS_NODEJS_POLYFILLED) {
    let input = new window.ReadableStreamBuffer({
      frequency: 1,
      // ffmpeg just can't if you change this. No output.
      // No idea why. This is probably terrible for performance.
      chunkSize: 1024*16
    });
    let output = new window.WritableStreamBuffer({
      initialSize: buffer.length * 10,
      incrementAmount: buffer.length * 10
    });
    await new Promise((res, rej) => {
      let proc = window.ffmpeg({ source: input })
        .toFormat('wav')
        // The decoder web-audio-engine uses doesn't like the extensible wav
        // format, which is triggered by exceeding any of these (16bit 2ch 48kHz)
        // Probably not amazing for audio quality but we're already re-encoding
        // (lossy?) ogg so not like it's noticeable
        .audioFrequency(48000) // -ar 48000
        .audioChannels(2) // -ac 2
        .audioCodec('pcm_s16le') // -acodec pcm_s16le
        .on('stderr', line => status('FFMPEG>' + line))
        .on('end', () => {
          status('ffmpeg done');
          res();
        })
        .on('error', ex => {
          status('ffmpeg error: ' + ex);
          rej(ex);
        })
        .pipe(output);
      window.proc = proc;
      input.put(Buffer.from(buffer));
      input.stop();
    });
    buffer = output.getContents();
  }
  const decoderCtx = new window.OfflineAudioContext(channels, sampleRate, sampleRate);
  return await decoderCtx.decodeAudioData(buffer);
}

export async function fetchAtlas(abort_controller_signal=undefined) {
  // CORS issue when fetching from second URL
  let srcUrl = (typeof window !== 'undefined' && window.browser && window.browser.electron)
    ? 'tetrio-plus://tetrio-plus/js/tetrio.js?bypass-tetrio-plus'
    : 'https://tetr.io/js/tetrio.js?bypass-tetrio-plus';
  let srcRequest = await window.fetch(srcUrl, { signal: abort_controller_signal });
  let src = await srcRequest.text();

  let match = /({[^{}]*boardappear\:\[[\d.e+]+,[\d.e+]+\][^{}]*})/.exec(src);
  if (!match) throw new Error('Failed to find sfx atlas');

  console.log("sfx atlas match", match[1]);
  
  let json = match[1]
    // Quote unquoted keys
    .replace(/(\s*?{\s*?|\s*?,\s*?)(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '$1"$3":');

  return JSON.parse(json);
}

export async function fetchAudio() {
  let oggUrl = (typeof window !== 'undefined' && window.browser && window.browser.electron)
    ? 'tetrio-plus://tetrio-plus/sfx/tetrio.ogg?bypass-tetrio-plus'
    : 'https://tetr.io/sfx/tetrio.ogg?bypass-tetrio-plus';
  let request = await window.fetch(oggUrl);
  let encodedSfxBuffer = await request.arrayBuffer();
  return await decodeAudio(encodedSfxBuffer);
}

export async function decodeDefaults(status=(()=>{})) {
  let sprites = [];

  status('Fetching sound atlas (js/tetrio.js)');
  let atlas = await fetchAtlas();
  status('Fetching audio file (sfx/tetrio.ogg)');
  let sfxBuffer = await fetchAudio();
  status('Assembling audio sprites...');
  for (let key of Object.keys(atlas)) {
    let [offset, duration] = atlas[key];
    // Convert milliseconds to seconds
    offset /= 1000; duration /= 1000;

    const ctx = new window.OfflineAudioContext(
      channels,
      sampleRate*duration,
      sampleRate
    );

    let source = ctx.createBufferSource();
    source.buffer = sfxBuffer;
    source.connect(ctx.destination);
    source.start(0, offset, duration);
    let audioBuffer = await ctx.startRendering();

    sprites.push({
      name: key,
      buffer: audioBuffer,
      offset,
      duration,
      modified: false
    });
  }

  return sprites;
}
