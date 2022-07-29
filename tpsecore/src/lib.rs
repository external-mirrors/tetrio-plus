use std::collections::HashMap;

use std::path::Path;
use lazy_static::lazy_static;
use crate::tpse::{TPSE};
use wasm_bindgen::prelude::wasm_bindgen;
use std::sync::Mutex;

use wasm_bindgen::JsValue;
use crate::import::ImportType;

mod tpse;
mod import;

#[derive(Default)]
struct State {
    active_tpse_files: HashMap<u32, TPSE>,
    id_incr: u32
}

lazy_static! {
    static ref GLOBAL_STATE: Mutex<State> = {
        #[cfg(target_arch = "wasm32")] {
            std::panic::set_hook(Box::new(console_error_panic_hook::hook));
            console_log::init_with_level(log::Level::Debug);
        }
        #[cfg(not(target_arch = "wasm32"))] {
            simple_logger::SimpleLogger::new().env().init().unwrap();
        }
        Default::default()
    };
}

#[wasm_bindgen]
pub fn create_tpse() -> u32 {
    let mut state = GLOBAL_STATE.lock().unwrap();
    let id = state.id_incr;
    state.id_incr += 1;
    state.active_tpse_files.insert(id, Default::default());
    log::debug!("Creating TPSE {}", id);
    id
}

#[derive(Debug, serde::Serialize, thiserror::Error)]
#[serde(tag = "error")]
pub enum ImportError {
    #[error("Invalid TPSE handle")]
    InvalidTPSEHandle,
    #[error("Unknown file type")]
    UnknownFileType,
    #[error("Invalid TPSE: {0}")]
    InvalidTPSE(String)
}

enum FileType {
    Zip,
    TPSE,
    Image,
    Video,
    Audio
}
impl FileType {
    pub fn from_mime(string: &str) -> Option<FileType> {
        todo!()
    }
    pub fn from_extension(string: &str) -> Option<FileType> {
        match string {
            "zip" => Some(FileType::Zip),
            "tpse" => Some(FileType::TPSE),
            "svg" | "png" | "jpg" | "jpeg" | "gif" | "webp" => Some(FileType::Image),
            "mp4" | "webm" => Some(FileType::Video),
            "ogg" | "mp3" | "flac" => Some(FileType::Audio),
            _ => return None
        }
    }
}

#[wasm_bindgen]
pub fn import_file(tpse: u32, import_type: JsValue, filename: String, bytes: &[u8]) -> Result<(), JsValue> {
    log::debug!("[TPSE {}] Importing file {} as {:?}.", tpse, filename, import_type);
    let import_type = import_type.into_serde().map_err(|err| JsValue::from(err.to_string()))?;
    import_file_internal(tpse, import_type, &filename, bytes)
      .map_err(|err| JsValue::from_serde(&err).unwrap())
}

pub fn import_file_internal(tpse: u32, import_type: ImportType, filename: &str, bytes: &[u8]) -> Result<(), ImportError> {
    let mut state = GLOBAL_STATE.lock().unwrap();
    let tpse = match state.active_tpse_files.get_mut(&tpse) {
        None => return Err(ImportError::InvalidTPSEHandle),
        Some(tpse) => tpse
    };
    let ext = match Path::new(&filename).extension() {
        None => return Err(ImportError::UnknownFileType),
        Some(some) => some
    };
    let file_type = match FileType::from_extension(&ext.to_string_lossy()) {
        None => return Err(ImportError::UnknownFileType),
        Some(some) => some
    };

    match file_type {
        FileType::TPSE => {
            let new_tpse: TPSE = match serde_json::from_slice(bytes) {
                Err(err) => return Err(ImportError::InvalidTPSE(err.to_string())),
                Ok(tpse) => tpse
            };
            tpse.merge(new_tpse);
            Ok(())
        }
        _ => todo!()
    }
}

#[wasm_bindgen]
pub fn export_tpse(tpse: u32) -> Option<String> {
    log::debug!("[TPSE {}] Exporting.", tpse);
    let state = GLOBAL_STATE.lock().unwrap();
    match state.active_tpse_files.get(&tpse) {
        Some(tpse) => Some(serde_json::to_string(tpse).unwrap()),
        None => None
    }
}

#[wasm_bindgen]
pub fn drop_tpse(tpse: u32) -> bool {
    log::debug!("[TPSE {}] Dropped!", tpse);
    let mut state = GLOBAL_STATE.lock().unwrap();
    state.active_tpse_files.remove(&tpse).is_some()
}

#[cfg(test)]
mod tests {
    use serde_json::Value;
    use crate::{create_tpse, drop_tpse, export_tpse, import_file, import_file_internal, ImportType};
    use crate::import::SkinType;

    #[test]
    fn basic_import_export() {
        let id = create_tpse();
        let filename = "tpse-basic-most-keys.tpse";
        let bytes = include_bytes!("../testdata/tpse-basic-most-keys.tpse");
        import_file_internal(id, ImportType::Automatic, filename, bytes).unwrap();
        let exported: Value = serde_json::from_str(&export_tpse(id).unwrap()).unwrap();
        let expected: Value = serde_json::from_slice(bytes).unwrap();
        assert_eq!(
            exported.as_object().unwrap().keys().collect::<Vec<&String>>(),
            expected.as_object().unwrap().keys().collect::<Vec<&String>>()
        );
        assert!(drop_tpse(id));
    }

    #[test]
    fn skin_slicer() {
        let tpse1 = create_tpse();
        let tpse2 = create_tpse();
        let tpse3 = create_tpse();
        let filename = "seven-segment.zip";
        let bytes = include_bytes!("../testdata/seven-segment.zip");
        import_file_internal(tpse1, ImportType::Automatic, filename, bytes).unwrap();
        import_file_internal(tpse2, ImportType::Skin { subtype: SkinType::Tetrio61Connected }, filename, bytes).unwrap();
        import_file_internal(tpse3, ImportType::Skin { subtype: SkinType::TetrioRaster }, filename, bytes).unwrap();
        assert_eq!(export_tpse(tpse1), export_tpse(tpse2));
        assert_ne!(export_tpse(tpse1), export_tpse(tpse3))
    }
}
