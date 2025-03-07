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


/**
 * @param {AbortController} [abort_controller] - Abort controller to cancel the request.  
 *  Must be a controller, not a signal, as the controller will be aborted internally after the atlas-containing header is received.
 */
export function fetchAtlas(abort_controller) {
  abort_controller ||= new AbortController();
  
  return new Promise((res, rej) => {
    fetchAudio({
      on_header(header) {
        res(header.sprites)
        abort_controller.abort();
      },
      on_error(error) {
        rej(error)
      },
      signal: abort_controller.signal
    });
  });
}

/**
 * @callback OnHeader
 * @param {Object} header
 * @param {Number} header.major
 * @param {Number} header.minor
 * @param {Object.<string,[number, number]> } header.sprites - a map of sprite name to [offset, duration]
 */
/**
 * @callback OnBuffer
 * @param {ArrayBuffer} buffer
 */
/**
 * @callback OnError
 * @param {Error} error
 */
/**
 * Fetches TETR.IO's rsd-format audio buffer
 * @param {Object} options - Options for fetching the audio data.
 * @param {OnHeader} [options.on_header] - Callback for the parsed audio header
 * @param {OnBuffer} [options.on_buffer] - Callback for the raw audio buffer
 * @param {OnError} [options.on_error] - Callback for errors at any point in the process
 * @param {AbortSignal} [options.signal] - AbortController signal to stop further processing
 * @return void
 */
function fetchAudio({ on_header, on_buffer, on_error, signal }) {
  (async () => {
    let url = (typeof window !== 'undefined' && window.browser && window.browser.electron)
      ? 'tetrio-plus://tetrio-plus/sfx/tetrio.opus.rsd?bypass-tetrio-plus'
      : 'https://tetr.io/sfx/tetrio.opus.rsd?bypass-tetrio-plus';
    let request = await window.fetch(url, { signal });
    let reader = request.body.getReader({ mode: 'byob' });
    
    window.trsd_log = [];
    async function read(length, expect_eof=false) {
      window.trsd_log.push(`tRSD parse: begin read ${length} ${expect_eof} ----------------------`);
      let buffer = new ArrayBuffer(length);
      
      // as usual, `min` isn't supported in chrome. at least it's not too hard to work around here.
      let offset = 0;
      while (offset < length) {
        let remaining = length - offset;
        window.trsd_log.push(`tRSD parse: read(new Uint8Array(${buffer}, ${offset}, ${remaining}, { min: ${remaining} }))`);
        let { value, done } = await reader.read(new Uint8Array(buffer, offset, remaining), { min: remaining });
        window.trsd_log.push(`tRSD parse: read chunk of ${value.byteLength} bytes`);
        offset += value.byteLength;
        buffer = value.buffer;
        
        if (done && !expect_eof) {
          window.trsd_log.push(`tRSD unexpected EOF ${offset}/${length}`);
          if (signal?.aborted)
            throw new Error(`tRSD: request aborted`);
          throw new Error(`tRSD: unexpected EOF after reading ${offset} of ${length} bytes`);
        }
      }
      if (length < 100) {
        let bytes = [...new Uint8Array(buffer)].map(s => s.toString(16).padStart(2, 0)).join(' ');
        window.trsd_log.push(`tRSD parse: read bytes: ${bytes}`);
      } else {
        window.trsd_log.push(`tRSD parse: read a lot of bytes (${offset} / ${buffer.byteLength})`);
      }
      
      // if we're expecting EOF, try reading another byte to see if it EOFs
      if (expect_eof) {
        let { value: _, done } = await reader.read(new Uint8Array(1), { min: 1 });
        if (!done) throw new Error(`tRSD: expected EOF`);
      }
      
      return new DataView(buffer);
    }
    
    let header_ok = (await read(4)).getUint32(0) == 0x74525344; // "tRSD"
    if (!header_ok) console.warn("tRSD: bad header");
    window.trsd_log.push(`tRSD: found header, ok: ${header_ok}`);
    
    let major = (await read(4)).getUint32(0, true);
    window.trsd_log.push(`tRSD: found major ${major}`);
    let minor = (await read(4)).getUint32(0, true);
    window.trsd_log.push(`tRSD: found minor ${minor}`);
    if (major != 1) console.warn(`tRSD: major version mismatch (got ${major})`);
    if (minor != 0) console.warn(`tRSD: minor version mismatch (got ${minor})`);
    
    let sprites = [];
    let last_audio_offset = 0;
    while (true) {
      let audio_offset = (await read(4)).getFloat32(0, true);
      window.trsd_log.push(`tRSD: found audio offset ${audio_offset}`);
      let name_length = (await read(4)).getUint32(0, true);
      window.trsd_log.push(`tRSD: found sprite name length ${name_length}`);
      if (name_length > 1000) throw new Error("tRSD: sprite name too long, parser probably in a bad state");
      if (name_length == 0) {
        last_audio_offset = audio_offset;
        break;
      }
      
      let name = new TextDecoder().decode(await read(name_length));
      sprites.push({ offset: audio_offset, name });
      window.trsd_log.push(`tRSD: found sprite ${name_length} ${name.slice(0,100)} ${audio_offset}`);
      if (sprites.length > 2000) throw new Error("tRSD: too many sprites, parser probably in a bad state");
    }
    
    for (let i = 0; i < sprites.length; i++) {
      let next_audio_offset = (i == sprites.length-1) ? last_audio_offset : sprites[i+1].offset;
      sprites[i].duration = next_audio_offset - sprites[i].offset;
    }
    sprites = Object.fromEntries(sprites.map(({ offset, duration, name }) => [name, [offset, duration]]));
    on_header?.({ major, minor, sprites });
    
    let audio_buffer_length = (await read(4)).getUint32(0, true);
    window.trsd_log.push(`tRSD: found audio buffer length ${audio_buffer_length}`);
    let buffer = (await read(audio_buffer_length, true)).buffer;
    console.log(new Uint8Array(buffer));
    on_buffer?.(buffer);
  })().catch(on_error || (_=>{}));
}

export async function decodeDefaults(status=(()=>{})) {
  status('Fetching sound effects (atlas)');
  let atlas = null;
  let encodedSfxBuffer = null;
  await new Promise((res, rej) => fetchAudio({
    on_header({ sprites }) {
      status('Fetching sound effects (audio)');
      atlas = sprites;
    },
    on_buffer(buffer) {
      encodedSfxBuffer = buffer;
      res();
    },
    on_error(err) {
      rej(err);
    }
  }));
  let sfxBuffer = await decodeAudio(encodedSfxBuffer);
  console.log("got sprites", atlas);
  
  status('Assembling audio sprites...');
  let sprites = [];
  for (let key of Object.keys(atlas)) {
    let [offset, duration] = atlas[key];
    console.log(key, offset, duration);

    const ctx = new window.OfflineAudioContext(channels, sampleRate*duration, sampleRate);

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

  status('Sprites assembled');
  return sprites;
}
