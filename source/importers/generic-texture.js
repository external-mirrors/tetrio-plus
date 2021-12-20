export const KEYS = {
  BOARD: {
    url: 'https://tetr.io/res/skins/board/generic/board.png',
    storagekey: 'board',
    filekey: '_board'
  },
  QUEUE: {
    url: 'https://tetr.io/res/skins/board/generic/queue.png',
    storagekey: 'queue',
    filekey: '_queue'
  },
  GRID: {
    url: 'https://tetr.io/res/skins/board/generic/grid.png',
    storagekey: 'grid',
    filekey: '_grid'
  },
  PARTICLE_BEAM: {
    url: 'https://tetr.io/res/particles/beam.png',
    storagekey: 'particle_beam',
    filekey: '_particle_beam'
  },
  PARTICLE_BEAMS_BEAM: {
    url: 'https://tetr.io/res/particles/beams/beam.png',
    storagekey: 'particle_beams_beam',
    filekey: '_particle_beams_beam'
  },
  PARTICLE_BIGBOX: {
    url: 'https://tetr.io/res/particles/bigbox.png',
    storagekey: 'particle_bigbox',
    filekey: '_particle_bigbox'
  },
  PARTICLE_BOX: {
    url: 'https://tetr.io/res/particles/box.png',
    storagekey: 'particle_box',
    filekey: '_particle_box'
  },
  PARTICLE_CHIP: {
    url: 'https://tetr.io/res/particles/chip.png',
    storagekey: 'particle_chip',
    filekey: '_particle_chip'
  },
  PARTICLE_CHIRP: {
    url: 'https://tetr.io/res/particles/chirp.png',
    storagekey: 'particle_chirp',
    filekey: '_particle_chirp'
  },
  PARTICLE_DUST: {
    url: 'https://tetr.io/res/particles/dust.png',
    storagekey: 'particle_dust',
    filekey: '_particle_dust'
  },
  PARTICLE_FBOX: {
    url: 'https://tetr.io/res/particles/fbox.png',
    storagekey: 'particle_fbox',
    filekey: '_particle_fbox'
  },
  PARTICLE_FIRE: {
    url: 'https://tetr.io/res/particles/fire.png',
    storagekey: 'particle_fire',
    filekey: '_particle_fire'
  },
  PARTICLE_PARTICLE: {
    url: 'https://tetr.io/res/particles/particle.png',
    storagekey: 'particle_particle',
    filekey: '_particle_particle'
  },
  PARTICLE_SMOKE: {
    url: 'https://tetr.io/res/particles/smoke.png',
    storagekey: 'particle_smoke',
    filekey: '_particle_smoke'
  },
  PARTICLE_STAR: {
    url: 'https://tetr.io/res/particles/star.png',
    storagekey: 'particle_star',
    filekey: '_particle_star'
  },
  PARTICLE_FLAKE: {
    url: 'https://tetr.io/res/particles/flake.png',
    storagekey: 'particle_flake',
    filekey: '_particle_flake'
  }
};

const importers = {};
for (let [id, { storagekey, filekey }] of Object.entries(KEYS)) {
  importers[id] = {
    async test(files) {
      if (files.length != 1) return false;
      return files[0].name.includes(filekey);
    },
    async load(files, storage) {
      await storage.set({ [storagekey]: files[0].data });
      return { type: `generic`, format: storagekey }
    }
  }
}
export default importers;
