let keys = {
  board: 'https://tetr.io/res/skins/board/generic/board.png',
  queue: 'https://tetr.io/res/skins/board/generic/queue.png',
  grid: 'https://tetr.io/res/skins/board/generic/grid.png',
  particle_beam: 'https://tetr.io/res/particles/beam.png',
  particle_beams_beam: 'https://tetr.io/res/particles/beams/beam.png',
  particle_bigbox: 'https://tetr.io/res/particles/bigbox.png',
  particle_box: 'https://tetr.io/res/particles/box.png',
  particle_chip: 'https://tetr.io/res/particles/chip.png',
  particle_chirp: 'https://tetr.io/res/particles/chirp.png',
  particle_dust: 'https://tetr.io/res/particles/dust.png',
  particle_fbox: 'https://tetr.io/res/particles/fbox.png',
  particle_fire: 'https://tetr.io/res/particles/fire.png',
  particle_particle: 'https://tetr.io/res/particles/particle.png',
  particle_smoke: 'https://tetr.io/res/particles/smoke.png',
  particle_star: 'https://tetr.io/res/particles/star.png',
  particle_flake: 'https://tetr.io/res/particles/flake.png'
};

for (let [key, url] of Object.entries(keys)) {
  createRewriteFilter(`Texture asset: ${key}`, url + '*', {
    enabledFor: async (storage, url) => {
      let res = await storage.get(key);
      return !!res[key];
    },
    onStop: async (storage, url, src, callback) => {
      callback({
        type: 'image/png',
        data: (await storage.get(key))[key],
        encoding: 'base64-data-url'
      });
    }
  })
}
