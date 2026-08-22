//! Bar-vs-bar clash detection (§D.2, M3 T6, plan Q2/Q8) — the capsule-over-
//! polyline model: a bar is its centerline polyline + radius; two bars CLASH
//! when their minimum centerline distance is strictly below r₁ + r₂. The
//! report carries the exact centerline distance (mm); the radii comparison
//! happens here so TS gets clash pairs directly.
//!
//! Method per the M3 Q2 decision gate (all three criteria PASSED — the dated
//! verdict lives in doc 09 and the T6 task log): **parry3d-f64 ADOPTED** as
//! the distance primitive (the locked-stack library, doc 03/09 confirmed) —
//! segment–segment centerline distance per polyline segment pair (parry's
//! own capsule distance is exactly this minus the radii, so radii stay
//! caller-side here), with AABB pre-filters at the bar level and the segment
//! level. The analytic reference implementation the spike probed against
//! stays in the test module — the corpus agreement test (1e-6 mm) is a
//! permanent regression pin. Bar PAIRS are checked model-wide (never
//! per-host) so M4 openings/junction elements slot in without redesign.

use parry3d_f64::math::{Pose, Vector};
use parry3d_f64::query::distance as parry_distance;
use parry3d_f64::shape::Segment;
use wasm_bindgen::prelude::*;

const COMPONENTS_PER_POINT: usize = 3;

pub(crate) type Point3 = [f64; COMPONENTS_PER_POINT];

/// The distance primitive (Q2 gate verdict: parry3d-f64, adopted
/// 2026-08-22): minimum centerline distance between two segments through
/// parry's stable `query::distance`. Segment–segment is always supported
/// (the spike corpus probed it) — an `Unsupported` error maps to +∞
/// (no-clash) rather than panicking across the boundary (§D purity).
fn centerline_segment_distance(p1: Point3, q1: Point3, p2: Point3, q2: Point3) -> f64 {
    let to_vector = |point: Point3| Vector::new(point[0], point[1], point[2]);
    let segment1 = Segment::new(to_vector(p1), to_vector(q1));
    let segment2 = Segment::new(to_vector(p2), to_vector(q2));
    parry_distance(&Pose::identity(), &segment1, &Pose::identity(), &segment2)
        .unwrap_or(f64::INFINITY)
}

/// Axis-aligned bounding box of one bar's centerline polyline.
pub(crate) struct Aabb {
    min: Point3,
    max: Point3,
}

pub(crate) fn polyline_aabb(points: &[Point3]) -> Aabb {
    let mut min = points[0];
    let mut max = points[0];
    for point in &points[1..] {
        for axis in 0..COMPONENTS_PER_POINT {
            min[axis] = min[axis].min(point[axis]);
            max[axis] = max[axis].max(point[axis]);
        }
    }
    Aabb { min, max }
}

/// Euclidean gap between two AABBs — 0 when they overlap. A clash is only
/// possible when the gap is strictly below r₁ + r₂, so a gap ≥ r₁ + r₂ lets
/// the caller skip every exact segment distance of the pair.
pub(crate) fn aabb_gap(a: &Aabb, b: &Aabb) -> f64 {
    let mut gap_sq = 0.0;
    for axis in 0..COMPONENTS_PER_POINT {
        let gap = (a.min[axis] - b.max[axis])
            .max(b.min[axis] - a.max[axis])
            .max(0.0);
        gap_sq += gap * gap;
    }
    gap_sq.sqrt()
}

/// Clash report across the boundary (the `BarGroupLayout` pattern — JS reads
/// the getters and calls `.free()`). `pairs` is flat index pairs
/// [a₀, b₀, a₁, b₁, …] into the caller's bar array (a < b, ascending — ids
/// stay TS-side per §D.3); `distances` is the parallel minimum centerline
/// distance per pair (mm).
#[wasm_bindgen]
pub struct ClashPairs {
    pairs: Vec<u32>,
    distances: Vec<f64>,
}

#[wasm_bindgen]
impl ClashPairs {
    #[wasm_bindgen(getter)]
    pub fn pairs(&self) -> Vec<u32> {
        self.pairs.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn distances(&self) -> Vec<f64> {
        self.distances.clone()
    }
}

/// Minimum centerline distance between two polylines (segment-level AABB
/// pre-filter before each exact distance).
fn polyline_distance(a: &[Point3], b: &[Point3], clash_radius: f64) -> f64 {
    let mut min_distance = f64::INFINITY;
    for segment_a in a.windows(2) {
        let aabb_a = polyline_aabb(segment_a);
        for segment_b in b.windows(2) {
            let aabb_b = polyline_aabb(segment_b);
            if aabb_gap(&aabb_a, &aabb_b) >= clash_radius.max(min_distance) {
                continue;
            }
            let distance =
                centerline_segment_distance(segment_a[0], segment_a[1], segment_b[0], segment_b[1]);
            min_distance = min_distance.min(distance);
        }
    }
    min_distance
}

/// §D.3 boundary function: flat bar centerlines + radii in, clash pairs out.
///
/// `path_points` holds every bar's centerline concatenated as xyz triples
/// (mm); `path_offsets` is the n + 1 point-offset index into it (bar k's
/// points are `path_offsets[k] .. path_offsets[k + 1]`); `radii` carries one
/// radius (mm) per bar. A pair CLASHES when its minimum centerline distance
/// is strictly below r₁ + r₂ (touching exactly is not a clash). Output order
/// is deterministic: pairs ascend lexicographically (i < j).
///
/// Invalid input (ragged offsets, fewer than 2 points per bar, non-finite
/// numbers, non-positive radii) returns an empty report — TS-side callers
/// pass already-validated model bars.
#[wasm_bindgen]
pub fn check_bar_collisions(
    path_points: &[f64],
    path_offsets: &[u32],
    radii: &[f64],
) -> ClashPairs {
    let empty = || ClashPairs {
        pairs: Vec::new(),
        distances: Vec::new(),
    };
    let bar_count = path_offsets.len().saturating_sub(1);
    let valid_structure = path_offsets.len() >= 2
        && path_offsets[0] == 0
        && path_offsets.windows(2).all(|window| window[0] < window[1])
        && radii.len() == bar_count
        && usize::try_from(path_offsets[bar_count]).is_ok_and(|total| {
            total * COMPONENTS_PER_POINT == path_points.len()
                && path_offsets
                    .windows(2)
                    .all(|window| window[1] - window[0] >= 2)
        });
    let valid_numbers = path_points
        .iter()
        .chain(radii.iter())
        .all(|value| value.is_finite())
        && radii.iter().all(|radius| *radius > 0.0);
    if !valid_structure || !valid_numbers {
        return empty();
    }

    // Offsets were just validated (strictly increasing, the last one fits
    // usize), so every conversion succeeds — the fallback is unreachable.
    let offsets: Vec<usize> = path_offsets
        .iter()
        .map(|&offset| usize::try_from(offset).unwrap_or(usize::MAX))
        .collect();
    let points: Vec<Point3> = path_points
        .chunks_exact(COMPONENTS_PER_POINT)
        .map(|chunk| [chunk[0], chunk[1], chunk[2]])
        .collect();
    let bars: Vec<(&[Point3], Aabb)> = offsets
        .windows(2)
        .map(|window| {
            let slice = &points[window[0]..window[1]];
            (slice, polyline_aabb(slice))
        })
        .collect();

    let mut pairs = Vec::new();
    let mut distances = Vec::new();
    for i in 0..bar_count {
        for j in (i + 1)..bar_count {
            let clash_radius = radii[i] + radii[j];
            if aabb_gap(&bars[i].1, &bars[j].1) >= clash_radius {
                continue;
            }
            let distance = polyline_distance(bars[i].0, bars[j].0, clash_radius);
            if distance < clash_radius {
                // Bar counts in a project are far below u32::MAX (the §A
                // reference scale is 1,000) — the fallback is unreachable.
                pairs.push(u32::try_from(i).unwrap_or(u32::MAX));
                pairs.push(u32::try_from(j).unwrap_or(u32::MAX));
                distances.push(distance);
            }
        }
    }
    ClashPairs { pairs, distances }
}

#[cfg(test)]
mod tests;
