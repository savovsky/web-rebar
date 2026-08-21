//! Plane–polyline intersection (§G.1 Tier 1): a section plane cuts a bar where
//! the bar's stored 3D path crosses the plane — the 2D section draws a dot per
//! crossing. Pure linear math on flat arrays, no BREP kernel needed (§D).

use wasm_bindgen::prelude::*;

/// Signed-distance tolerance (mm) for "point lies on the plane".
const PLANE_TOLERANCE: f64 = 1e-6;

const COMPONENTS_PER_POINT: usize = 3;

/// §D.3 boundary function: flat plane (origin + unit normal) and flat polyline
/// path in ([x1,y1,z1, x2,y2,z2, ...], mm), flat intersection points out —
/// one point per crossing, so a bent bar can cross the plane 0..n times.
///
/// Rules (the sectioning orchestration relies on these):
/// - one point per segment that strictly CROSSES the plane;
/// - a vertex lying exactly on the plane is reported once, as the START of the
///   segment leaving it — shared vertices never double-count (a final path
///   vertex on the plane is not reported);
/// - segments lying IN the plane (both endpoints on it) contribute nothing —
///   a bar running in the cut plane is drawn as a line, not a dot.
///
/// Invalid input (wrong component counts, fewer than 2 points, zero normal)
/// returns an empty vector — validation upstream (commands) prevents this.
#[wasm_bindgen]
pub fn plane_polyline_intersection(
    plane_origin: &[f64],
    plane_normal: &[f64],
    path_points: &[f64],
) -> Vec<f64> {
    if plane_origin.len() != COMPONENTS_PER_POINT
        || plane_normal.len() != COMPONENTS_PER_POINT
        || !path_points.len().is_multiple_of(COMPONENTS_PER_POINT)
        || path_points.len() < 2 * COMPONENTS_PER_POINT
    {
        return Vec::new();
    }
    let normal_length = (plane_normal[0] * plane_normal[0]
        + plane_normal[1] * plane_normal[1]
        + plane_normal[2] * plane_normal[2])
        .sqrt();
    if normal_length == 0.0 {
        return Vec::new();
    }
    // Normalize defensively — §D pure functions must not rely on the caller.
    let normal = [
        plane_normal[0] / normal_length,
        plane_normal[1] / normal_length,
        plane_normal[2] / normal_length,
    ];
    let signed_distance = |point: &[f64]| {
        (point[0] - plane_origin[0]) * normal[0]
            + (point[1] - plane_origin[1]) * normal[1]
            + (point[2] - plane_origin[2]) * normal[2]
    };

    let points: Vec<&[f64]> = path_points.chunks_exact(COMPONENTS_PER_POINT).collect();
    let distances: Vec<f64> = points.iter().map(|point| signed_distance(point)).collect();
    let mut intersections = Vec::new();
    for i in 0..points.len() - 1 {
        let d0 = distances[i];
        let d1 = distances[i + 1];
        let is_start_on_plane = d0.abs() <= PLANE_TOLERANCE;
        let is_end_on_plane = d1.abs() <= PLANE_TOLERANCE;
        if is_start_on_plane && is_end_on_plane {
            continue; // the whole segment lies in the plane — no dot
        }
        if is_start_on_plane {
            intersections.extend_from_slice(points[i]); // vertex counted once, as segment start
            continue;
        }
        if is_end_on_plane || d0.signum() == d1.signum() {
            continue; // end vertex is the next segment's start; same side = no crossing
        }
        let t = d0 / (d0 - d1);
        let (p0, p1) = (points[i], points[i + 1]);
        intersections.push(p0[0] + t * (p1[0] - p0[0]));
        intersections.push(p0[1] + t * (p1[1] - p0[1]));
        intersections.push(p0[2] + t * (p1[2] - p0[2]));
    }
    intersections
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Vertical plane x = 500.
    const PLANE_X500_ORIGIN: [f64; 3] = [500.0, 0.0, 0.0];
    const PLANE_X500_NORMAL: [f64; 3] = [1.0, 0.0, 0.0];

    #[test]
    fn crossing_segment_returns_the_interpolated_point() {
        let path = [0.0, 0.0, 0.0, 1000.0, 0.0, 0.0];
        let hits = plane_polyline_intersection(&PLANE_X500_ORIGIN, &PLANE_X500_NORMAL, &path);
        assert_eq!(hits, vec![500.0, 0.0, 0.0]);
    }

    #[test]
    fn bent_path_can_cross_multiple_times() {
        // Zigzag through the plane: a vertical section can cut a horizontal
        // bar path 0..n times — each crossing becomes a dot.
        let path = [0.0, 0.0, 0.0, 1000.0, 0.0, 0.0, 0.0, 500.0, 0.0];
        let hits = plane_polyline_intersection(&PLANE_X500_ORIGIN, &PLANE_X500_NORMAL, &path);
        assert_eq!(hits, vec![500.0, 0.0, 0.0, 500.0, 250.0, 0.0]);
    }

    #[test]
    fn parallel_segment_off_the_plane_yields_nothing() {
        let path = [0.0, 100.0, 0.0, 1000.0, 100.0, 0.0];
        let origin = [0.0, 0.0, 0.0];
        let normal = [0.0, 1.0, 0.0];
        assert!(plane_polyline_intersection(&origin, &normal, &path).is_empty());
    }

    #[test]
    fn path_entirely_on_one_side_yields_nothing() {
        let path = [600.0, 0.0, 0.0, 1000.0, 300.0, 0.0];
        assert!(
            plane_polyline_intersection(&PLANE_X500_ORIGIN, &PLANE_X500_NORMAL, &path).is_empty()
        );
    }

    #[test]
    fn vertex_on_the_plane_is_counted_once() {
        // The shared vertex (500,0,0) must produce exactly one dot even
        // though two segments touch it.
        let path = [0.0, 0.0, 0.0, 500.0, 0.0, 0.0, 1000.0, 0.0, 0.0];
        let hits = plane_polyline_intersection(&PLANE_X500_ORIGIN, &PLANE_X500_NORMAL, &path);
        assert_eq!(hits, vec![500.0, 0.0, 0.0]);
    }

    #[test]
    fn path_starting_on_the_plane_reports_its_first_vertex() {
        let path = [500.0, 100.0, 0.0, 1000.0, 100.0, 0.0];
        let hits = plane_polyline_intersection(&PLANE_X500_ORIGIN, &PLANE_X500_NORMAL, &path);
        assert_eq!(hits, vec![500.0, 100.0, 0.0]);
    }

    #[test]
    fn segment_lying_in_the_plane_yields_nothing() {
        // Bar running IN the cut plane: drawn as a line, not a dot.
        let path = [0.0, 0.0, 0.0, 1000.0, 0.0, 500.0];
        let origin = [0.0, 0.0, 0.0];
        let normal = [0.0, 1.0, 0.0];
        assert!(plane_polyline_intersection(&origin, &normal, &path).is_empty());
    }

    #[test]
    fn non_unit_normal_is_normalized() {
        let path = [0.0, 0.0, 0.0, 1000.0, 0.0, 0.0];
        let scaled_normal = [13.0, 0.0, 0.0];
        let hits = plane_polyline_intersection(&PLANE_X500_ORIGIN, &scaled_normal, &path);
        assert_eq!(hits, vec![500.0, 0.0, 0.0]);
    }

    #[test]
    fn invalid_input_yields_empty() {
        let path = [0.0, 0.0, 0.0, 1000.0, 0.0, 0.0];
        // wrong origin/normal component counts
        assert!(plane_polyline_intersection(&[0.0, 0.0], &PLANE_X500_NORMAL, &path).is_empty());
        assert!(plane_polyline_intersection(&PLANE_X500_ORIGIN, &[1.0], &path).is_empty());
        // zero normal
        assert!(
            plane_polyline_intersection(&PLANE_X500_ORIGIN, &[0.0, 0.0, 0.0], &path).is_empty()
        );
        // fewer than 2 points / ragged flat array
        assert!(plane_polyline_intersection(
            &PLANE_X500_ORIGIN,
            &PLANE_X500_NORMAL,
            &[0.0, 0.0, 0.0]
        )
        .is_empty());
        assert!(
            plane_polyline_intersection(&PLANE_X500_ORIGIN, &PLANE_X500_NORMAL, &[0.0, 0.0])
                .is_empty()
        );
    }
}
