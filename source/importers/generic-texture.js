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
  },
  RANK_D: {
  	url: 'https://tetr.io/res/league-ranks/d.png',
  	storagekey: 'rank_d',
  	filekey: '_rank_d'
  },
  RANK_DPLUS: {
  	url: 'https://tetr.io/res/league-ranks/d+.png',
  	storagekey: 'rank_dplus',
  	filekey: '_rank_dplus'
  },
  RANK_CMINUS: {
  	url: 'https://tetr.io/res/league-ranks/c-.png',
  	storagekey: 'rank_cminus',
  	filekey: '_rank_cminus'
  },
  RANK_C: {
  	url: 'https://tetr.io/res/league-ranks/c.png',
  	storagekey: 'rank_c',
  	filekey: '_rank_c'
  },
  RANK_CPLUS: {
  	url: 'https://tetr.io/res/league-ranks/c+.png',
  	storagekey: 'rank_cplus',
  	filekey: '_rank_cplus'
  },
  RANK_BMINUS: {
  	url: 'https://tetr.io/res/league-ranks/b-.png',
  	storagekey: 'rank_bminus',
  	filekey: '_rank_bminus'
  },
  RANK_B: {
  	url: 'https://tetr.io/res/league-ranks/b.png',
  	storagekey: 'rank_b',
  	filekey: '_rank_b'
  },
  RANK_BPLUS: {
  	url: 'https://tetr.io/res/league-ranks/b+.png',
  	storagekey: 'rank_bplus',
  	filekey: '_rank_bplus'
  },
  RANK_AMINUS: {
  	url: 'https://tetr.io/res/league-ranks/a-.png',
  	storagekey: 'rank_aminus',
  	filekey: '_rank_aminus'
  },
  RANK_A: {
  	url: 'https://tetr.io/res/league-ranks/a.png',
  	storagekey: 'rank_a',
  	filekey: '_rank_a'
  },
  RANK_APLUS: {
  	url: 'https://tetr.io/res/league-ranks/a+.png',
  	storagekey: 'rank_aplus',
  	filekey: '_rank_aplus'
  },
  RANK_SMINUS: {
  	url: 'https://tetr.io/res/league-ranks/s-.png',
  	storagekey: 'rank_sminus',
  	filekey: '_rank_sminus'
  },
  RANK_S: {
  	url: 'https://tetr.io/res/league-ranks/s.png',
  	storagekey: 'rank_s',
  	filekey: '_rank_s'
  },
  RANK_SPLUS: {
  	url: 'https://tetr.io/res/league-ranks/s+.png',
  	storagekey: 'rank_splus',
  	filekey: '_rank_splus'
  },
  RANK_SS: {
  	url: 'https://tetr.io/res/league-ranks/ss.png',
  	storagekey: 'rank_ss',
  	filekey: '_rank_ss'
  },
  RANK_U: {
  	url: 'https://tetr.io/res/league-ranks/u.png',
  	storagekey: 'rank_u',
  	filekey: '_rank_u'
  },
  RANK_X: {
  	url: 'https://tetr.io/res/league-ranks/x.png',
  	storagekey: 'rank_x',
  	filekey: '_rank_x'
  },
  RANK_Z: {
  	url: 'https://tetr.io/res/league-ranks/z.png',
  	storagekey: 'rank_z',
  	filekey: '_rank_z'
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
