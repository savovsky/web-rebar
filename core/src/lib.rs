//! web-rebar geometry core.
//!
//! Architecture Spec §D: every exported function is stateless and pure — no
//! state is held across calls, and geometry crosses the WASM boundary as flat
//! arrays only (§D.3). Complex objects stay in TypeScript.

#![forbid(unsafe_code)]

use wasm_bindgen::prelude::*;

mod collision;
mod mesh;
mod placement_group;
mod section;

/// Crate version, surfaced to the app for WASM load verification.
#[wasm_bindgen]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// T1 round-trip probe: flat array in, scalar out.
#[wasm_bindgen]
pub fn sum_flat(values: &[f64]) -> f64 {
    values.iter().sum()
}

/// T1 round-trip probe: flat array in, flat array out (the §D.3 pattern every
/// geometry function will follow).
#[wasm_bindgen]
pub fn scale_flat(values: &[f64], factor: f64) -> Vec<f64> {
    values.iter().map(|v| v * factor).collect()
}
