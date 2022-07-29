use lazy_static::lazy_static;
use crate::import::ImportType::OtherSkin;
use regex::Regex;

#[derive(Debug, serde::Serialize, serde::Deserialize, Eq, PartialEq)]
#[serde(tag = "type", rename_all="snake_case")]
pub enum ImportType {
  /// An import type will be decided automatically.
  /// This is the only way to import a zip or tpse file
  Automatic,
  Skin {
    #[serde(flatten)]
    subtype: SkinType
  },
  OtherSkin {
    #[serde(flatten)]
    subtype: OtherSkinType
  },
  SoundEffects,
  Background,
  Music
}

impl ImportType {
  pub fn from_filekey(filename: &str) -> Option<Self> {
    use ImportType::*;
    use SkinType::*;
    use OtherSkinType::*;

    lazy_static! {
      static ref DELAY_REGEX: Regex = Regex::new(r"_delay=(\d+)").unwrap();
      static ref COMBINE_REGEX: Regex = Regex::new(r"_combine=(true|false)").unwrap();
    }

    let opts = AnimatedOptions {
      delay: DELAY_REGEX.captures(filename).and_then(|matches| {
        matches.get(1).unwrap().as_str().parse().ok()
      }),
      combine: COMBINE_REGEX.captures(filename).map(|matches| {
        matches.get(1).unwrap().as_str().parse().unwrap()
      })
    };

    if filename.contains("_unconnected_minos") {
      return Some(Skin { subtype: Tetrio61 });
    }
    if filename.contains("_unconnected_ghost") {
      return Some(Skin { subtype: Tetrio61Ghost });
    }
    if filename.contains("_connected_minos") {
      return Some(Skin { subtype: Tetrio61Connected });
    }
    if filename.contains("_connected_ghost") {
      return Some(Skin { subtype: Tetrio61ConnectedGhost });
    }
    if filename.contains("_animated_connected_minos") {
      return Some(Skin { subtype: Tetrio61ConnectedAnimated { opts }})
    }
    if filename.contains("_animated_connected_ghost") {
      return Some(Skin { subtype: Tetrio61ConnectedGhostAnimated { opts } })
    }
    if filename.contains("_old_tetrio") {
      return Some(Skin { subtype: TetrioRaster });
    }
    if filename.contains("_animated_old_tetrio") {
      return Some(Skin { subtype: TetrioAnimated { opts } });
    }
    if filename.contains("_jstris") {
      return Some(Skin { subtype: JstrisRaster });
    }
    if filename.contains("_animated_jstris") {
      return Some(Skin { subtype: JstrisAnimated { opts } });
    }
    if filename.contains("_board") {
      return Some(OtherSkin { subtype: Board });
    }
    if filename.contains("_queue") {
      return Some(OtherSkin { subtype: Queue });
    }
    if filename.contains("_grid") {
      return Some(OtherSkin { subtype: Grid });
    }
    if filename.contains("_particle_beam") {
      return Some(OtherSkin { subtype: ParticleBeam });
    }
    if filename.contains("_particle_beams_beam") {
      return Some(OtherSkin { subtype: ParticleBeamsBeam });
    }
    if filename.contains("_particle_bigbox") {
      return Some(OtherSkin { subtype: ParticleBigBox });
    }
    if filename.contains("_particle_box") {
      return Some(OtherSkin { subtype: ParticleBox });
    }
    if filename.contains("_particle_chip") {
      return Some(OtherSkin { subtype: ParticleChip });
    }
    if filename.contains("_particle_chirp") {
      return Some(OtherSkin { subtype: ParticleChirp });
    }
    if filename.contains("_particle_dust") {
      return Some(OtherSkin { subtype: ParticleDust });
    }
    if filename.contains("_particle_fbox") {
      return Some(OtherSkin { subtype: ParticleFBox });
    }
    if filename.contains("_particle_fire") {
      return Some(OtherSkin { subtype: ParticleFire });
    }
    if filename.contains("_particle_particle") {
      return Some(OtherSkin { subtype: ParticleParticle });
    }
    if filename.contains("_particle_smoke") {
      return Some(OtherSkin { subtype: ParticleSmoke });
    }
    return None;
  }
}

#[cfg(test)]
mod test {
  use crate::import::{AnimatedOptions, ImportType, SkinType};
  use crate::import::ImportType::Skin;

  #[test]
  fn from_filekey() {
    assert_eq!(ImportType::from_filekey("foo"), None);
    assert_eq!(
      ImportType::from_filekey("_animated_connected_minos_delay=20_combine=false"),
      Some(Skin {
        subtype: SkinType::Tetrio61ConnectedAnimated {
          opts: AnimatedOptions { delay: Some(20), combine: Some(false)}
        }
      })
    );
  }
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Eq, PartialEq)]
#[serde(tag = "subtype", rename_all = "snake_case")]
pub enum SkinType {
  Tetrio61,
  Tetrio61Ghost,
  Tetrio61Connected,
  Tetrio61ConnectedGhost,
  Tetrio61ConnectedAnimated { #[serde(flatten)] opts: AnimatedOptions },
  Tetrio61ConnectedGhostAnimated { #[serde(flatten)] opts: AnimatedOptions },

  TetrioAnimated { #[serde(flatten)] opts: AnimatedOptions },
  TetrioRaster,
  TetrioSVG,

  JstrisRaster,
  JstrisAnimated { #[serde(flatten)] opts: AnimatedOptions },
  JstrisConnected
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Eq, PartialEq)]
#[serde(tag = "subtype", rename_all = "snake_case")]
pub enum OtherSkinType {
  Board,
  Queue,
  Grid,
  ParticleBeam,
  ParticleBeamsBeam,
  ParticleBigBox,
  ParticleBox,
  ParticleChip,
  ParticleChirp,
  ParticleDust,
  ParticleFBox,
  ParticleFire,
  ParticleParticle,
  ParticleSmoke,
  ParticleStar,
  ParticleFlake,
  RankD,
  RankDPlus,
  RankCMinus,
  RankC,
  RankCPlus,
  RankBMinus,
  RankB,
  RankBPlus,
  RankAMinus,
  RankA,
  RankAPlus,
  RankSMinus,
  RankS,
  RankSPlus,
  RankSS,
  RankU,
  RankX,
  RankZ
}

#[derive(Default, Debug, serde::Serialize, serde::Deserialize, Eq, PartialEq)]
pub struct AnimatedOptions {
  /// A frame rate to override with. See `AnimMeta#delay`
  pub delay: Option<u32>,
  /// A combine frames setting to override with. Overrides any inferred gif combine setting.
  pub combine: Option<bool>
}