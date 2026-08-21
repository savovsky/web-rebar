//! Bar group layout generation (§F.2, M3 T2) — parametric face-local
//! sampling per plan Q1-a: a face-local (u,v) region rectangle is tessellated
//! into straight 2-point bar centerlines purely analytically — positions =
//! edge distance + k·spacing, path endpoints inset from the region's side
//! edges by cover semantics (flat end cap → cover exactly, the M0
//! `applyConcreteCover` rule), the whole path offset inward from the face by
//! cover + radius. No mesh involvement — the mesh is derived data (§H.2).
//!
//! Spacing-fallback semantics (in-task decision, recorded in the M3 T2 log):
//! the FIRST bar at the start edge distance is always placed when the edge
//! distances fit inside the region span (edgeStart + edgeEnd ≤ span);
//! further bars are added while position ≤ span − edgeEnd (with a tolerance
//! for edge-exact fits). So a spacing larger than the region yields a single
//! bar, and zero bars are only emitted when the edges alone exceed the span
//! (TS-side validation rejects that case before the call).

use wasm_bindgen::prelude::*;

/// f64 layout of one face frame across the boundary: origin, u axis, v axis,
/// outward normal — four xyz triples.
const FRAME_COMPONENTS: usize = 12;
/// Region rect across the boundary: [uMin, uMax, vMin, vMax].
const REGION_COMPONENTS: usize = 4;
/// Placement rule across the boundary: [cover, diameter, spacing,
/// edgeDistanceStart, edgeDistanceEnd] (mm).
const RULE_COMPONENTS: usize = 5;
/// mm — tolerance for the "position ≤ span − edgeEnd" comparison so an
/// edge-exact final bar still lands.
const POSITION_TOLERANCE: f64 = 1e-9;

/// Layout result: flat xyz triples (two endpoints per bar) plus the bar
/// count — JS reads via the getters and calls `.free()` (the MeshData
/// pattern).
#[wasm_bindgen]
pub struct BarGroupLayout {
    paths: Vec<f64>,
    bar_count: u32,
}

#[wasm_bindgen]
impl BarGroupLayout {
    #[wasm_bindgen(getter)]
    pub fn paths(&self) -> Vec<f64> {
        self.paths.clone()
    }
    #[wasm_bindgen(js_name = barCount)]
    pub fn bar_count(&self) -> u32 {
        self.bar_count
    }
}

fn point_on_face(origin: &[f64], axis_u: &[f64], axis_v: &[f64], u: f64, v: f64) -> [f64; 3] {
    [
        origin[0] + axis_u[0] * u + axis_v[0] * v,
        origin[1] + axis_u[1] * u + axis_v[1] * v,
        origin[2] + axis_u[2] * u + axis_v[2] * v,
    ]
}

/// §D.3 boundary function: flat face frame + flat region + flat rule in,
/// flat bar paths out.
///
/// `is_vertical` selects the run direction: vertical bars run along the face
/// `v` axis and are spaced along `u`; horizontal bars run along `u` and are
/// spaced along `v` (the M0 `FaceFrame` convention — for vertical wall faces
/// this is literal horizontal/vertical bars).
///
/// Invalid input (wrong component counts, non-finite numbers, diameter or
/// spacing ≤ 0, cover/edges < 0, inverted region) returns an empty layout —
/// TS-side validation (engine/placement-group.ts) rejects these first with
/// descriptive errors; the Rust side stays defensively pure (§D).
#[wasm_bindgen]
pub fn generate_bar_group_layout(
    face_frame: &[f64],
    region: &[f64],
    rule: &[f64],
    is_vertical: bool,
) -> BarGroupLayout {
    let empty = BarGroupLayout {
        paths: Vec::new(),
        bar_count: 0,
    };
    if face_frame.len() != FRAME_COMPONENTS
        || region.len() != REGION_COMPONENTS
        || rule.len() != RULE_COMPONENTS
    {
        return empty;
    }
    let cover_mm = rule[0];
    let diameter_mm = rule[1];
    let spacing_mm = rule[2];
    let edge_start_mm = rule[3];
    let edge_end_mm = rule[4];
    let valid = [
        cover_mm,
        diameter_mm,
        spacing_mm,
        edge_start_mm,
        edge_end_mm,
    ]
    .iter()
    .chain(face_frame.iter())
    .chain(region.iter())
    .all(|value| value.is_finite())
        && diameter_mm > 0.0
        && spacing_mm > 0.0
        && cover_mm >= 0.0
        && edge_start_mm >= 0.0
        && edge_end_mm >= 0.0;
    let (u_min, u_max, v_min, v_max) = (region[0], region[1], region[2], region[3]);
    if !valid || u_min >= u_max || v_min >= v_max {
        return empty;
    }

    let origin = &face_frame[0..3];
    let axis_u = &face_frame[3..6];
    let axis_v = &face_frame[6..9];
    let normal = &face_frame[9..12];
    let inward = cover_mm + diameter_mm / 2.0;
    // Run axis = u (horizontal) or v (vertical); the spacing axis is the
    // other one. Endpoints inset by cover exactly — a flat end cap at the
    // centerline endpoint keeps just the cover (M0 applyConcreteCover rule).
    let (spacing_min, spacing_max, run_min, run_max) = if is_vertical {
        (u_min + edge_start_mm, u_max - edge_end_mm, v_min, v_max)
    } else {
        (v_min + edge_start_mm, v_max - edge_end_mm, u_min, u_max)
    };
    let mut paths = Vec::new();
    let mut count: u32 = 0;
    if spacing_min <= spacing_max + POSITION_TOLERANCE {
        let mut position = spacing_min;
        while position <= spacing_max + POSITION_TOLERANCE {
            let (start_u, start_v, end_u, end_v) = if is_vertical {
                (position, run_min + cover_mm, position, run_max - cover_mm)
            } else {
                (run_min + cover_mm, position, run_max - cover_mm, position)
            };
            let start = point_on_face(origin, axis_u, axis_v, start_u, start_v);
            let end = point_on_face(origin, axis_u, axis_v, end_u, end_v);
            for point in [start, end] {
                paths.push(point[0] - normal[0] * inward);
                paths.push(point[1] - normal[1] * inward);
                paths.push(point[2] - normal[2] * inward);
            }
            count += 1;
            position += spacing_mm;
        }
    }
    BarGroupLayout {
        paths,
        bar_count: count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Vertical face, y = 0 plane: origin at the face corner, u = +X (wall
    ///  axis), v = +Z (up), normal = −Y.
    const FRAME_Y0: [f64; 12] = [
        0.0, 0.0, 0.0, // origin
        1.0, 0.0, 0.0, // u
        0.0, 0.0, 1.0, // v
        0.0, -1.0, 0.0, // outward normal (inward = +Y)
    ];
    /// Horizontal face, z = 0 plane (a wall top frame): u = +X, v = +Y.
    const FRAME_Z0: [f64; 12] = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
    /// 4000 × 2800 vertical face region (u × v).
    const REGION_4000X2800: [f64; 4] = [0.0, 4000.0, 0.0, 2800.0];

    fn layout(frame: &[f64], region: &[f64], rule: &[f64], is_vertical: bool) -> Vec<f64> {
        generate_bar_group_layout(frame, region, rule, is_vertical).paths()
    }

    #[test]
    fn horizontal_bars_on_a_vertical_face() {
        // Face 4000 (u) × 2800 (v); cover 25, Ø12 (r 6) → inward 31.
        // v positions: 60 + k·150 while ≤ 2800−60 = 2740 → 18 bars.
        let rule = [25.0, 12.0, 150.0, 60.0, 60.0];
        let paths = layout(&FRAME_Y0, &REGION_4000X2800, &rule, false);
        assert_eq!(paths.len(), 18 * 6);
        // First bar: v = 60 → z = 60; u endpoints inset by cover 25; y = 31.
        assert_eq!(&paths[0..6], &[25.0, 31.0, 60.0, 3975.0, 31.0, 60.0]);
        // Last bar: the largest 60 + k·150 ≤ 2740 → k = 17 → 2610.
        let last = &paths[(18 - 1) * 6..];
        assert_eq!(last, &[25.0, 31.0, 2610.0, 3975.0, 31.0, 2610.0]);
    }

    #[test]
    fn vertical_bars_on_a_vertical_face_swap_the_axes() {
        // Same face, vertical bars: run along v (z), spacing along u (x).
        // Positions: 60 + k·250 while ≤ 4000−60 = 3940 → 16 bars (k = 0..15).
        let rule = [25.0, 12.0, 250.0, 60.0, 60.0];
        let paths = layout(&FRAME_Y0, &REGION_4000X2800, &rule, true);
        assert_eq!(paths.len(), 16 * 6);
        // Endpoints inset by cover from the v (z) region edges.
        assert_eq!(&paths[0..6], &[60.0, 31.0, 25.0, 60.0, 31.0, 2775.0]);
        let last_bar = &paths[(16 - 1) * 6..];
        assert_eq!(last_bar, &[3810.0, 31.0, 25.0, 3810.0, 31.0, 2775.0]);
    }

    #[test]
    fn horizontal_face_frame_uses_the_same_math() {
        // Top face z = 0, u = +X, v = +Y (across the thickness), vertical
        // bars run along v → along +Y; inward offset along −Z.
        let region = [0.0, 4000.0, 0.0, 200.0];
        let rule = [25.0, 12.0, 300.0, 50.0, 50.0];
        let paths = layout(&FRAME_Z0, &region, &rule, true);
        // Positions along u: 50 + k·300 while ≤ 3950 → 14 bars.
        assert_eq!(paths.len(), 14 * 6);
        assert_eq!(&paths[0..6], &[50.0, 25.0, -31.0, 50.0, 175.0, -31.0]);
    }

    #[test]
    fn edge_exact_final_bar_still_lands() {
        // Span 300, edges 50+50, spacing 200 → positions 50 and 250 exactly.
        let region = [0.0, 300.0, 0.0, 1000.0];
        let rule = [25.0, 12.0, 200.0, 50.0, 50.0];
        let paths = layout(&FRAME_Y0, &region, &rule, true);
        assert_eq!(paths.len(), 2 * 6);
        assert_eq!(paths[0], 50.0);
        assert_eq!(paths[6], 250.0);
    }

    #[test]
    fn spacing_larger_than_the_region_yields_a_single_bar() {
        // Usable span 900 − (60 + 60) = 780; spacing 1000 > span → only the
        // first bar at the start edge is placed (in-task decision).
        let region = [0.0, 900.0, 0.0, 2800.0];
        let rule = [25.0, 12.0, 1000.0, 60.0, 60.0];
        let paths = layout(&FRAME_Y0, &region, &rule, true);
        assert_eq!(paths.len(), 6);
        assert_eq!(paths[0], 60.0);
    }

    #[test]
    fn edge_distances_exceeding_the_span_yield_zero_bars() {
        // Defensive: edges alone (700 + 700) exceed the span (1000) → empty.
        // TS-side validation rejects this case with a descriptive error.
        let region = [0.0, 1000.0, 0.0, 100.0];
        let rule = [25.0, 12.0, 100.0, 700.0, 700.0];
        let paths = layout(&FRAME_Y0, &region, &rule, true);
        assert!(paths.is_empty());
    }

    #[test]
    fn invalid_input_yields_an_empty_layout() {
        let region = [0.0, 900.0, 0.0, 100.0];
        let rule = [25.0, 12.0, 150.0, 0.0, 0.0];
        // Wrong frame/region/rule component counts.
        assert!(layout(&FRAME_Y0[..6], &region, &rule, false).is_empty());
        assert!(layout(&FRAME_Y0, &region[..3], &rule, false).is_empty());
        assert!(layout(&FRAME_Y0, &region, &rule[..4], false).is_empty());
        // Non-positive spacing / diameter, inverted region.
        assert!(layout(&FRAME_Y0, &region, &[25.0, 12.0, 0.0, 0.0, 0.0], false).is_empty());
        assert!(layout(&FRAME_Y0, &region, &[25.0, 0.0, 150.0, 0.0, 0.0], false).is_empty());
        assert!(layout(&FRAME_Y0, &[100.0, 0.0, 0.0, 100.0], &rule, false).is_empty());
        // Non-finite numbers rejected anywhere.
        assert!(layout(&FRAME_Y0, &region, &[25.0, 12.0, f64::NAN, 0.0, 0.0], false).is_empty());
    }

    #[test]
    fn bar_count_getter_matches_the_flat_length() {
        let rule = [25.0, 12.0, 150.0, 60.0, 60.0];
        let layout = generate_bar_group_layout(&FRAME_Y0, &REGION_4000X2800, &rule, false);
        assert_eq!(layout.bar_count(), 18);
        assert_eq!(layout.paths().len() / 6, 18);
    }
}
