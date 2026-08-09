//! Swept-cylinder bar mesh generation (§D.2: bar geometry lives in Rust/WASM).
//!
//! Winding convention: counter-clockwise front faces (Three.js default).
//! Ring frames are right-handed (u × v = path direction); side quads and cap
//! fans are wound to face outward accordingly.

use wasm_bindgen::prelude::*;

/// 3D vector as plain array — internal only, never crosses the boundary.
type V3 = [f32; 3];

const EPSILON: f32 = 1e-6;
/// Ring frames flip their reference axis when the path is near-vertical.
const VERTICAL_THRESHOLD: f32 = 0.9;
const MIN_SEGMENTS: u32 = 3;
/// Bend arcs: near-straight and near-reversing joints keep the sharp miter.
const ANGLE_EPSILON: f32 = 1e-4;
/// Arc rings per 90° of bend — dense enough that miter joints read as smooth.
const ARC_RINGS_PER_QUARTER_TURN: usize = 6;

/// Render mesh crossing the boundary as three typed arrays (§D.3 + Q1-b:
/// Float32 positions/normals, Uint32 indices — exactly what Three.js wants).
/// JS must call `.free()` after reading the arrays.
#[wasm_bindgen]
pub struct MeshData {
    positions: Vec<f32>,
    normals: Vec<f32>,
    indices: Vec<u32>,
}

#[wasm_bindgen]
impl MeshData {
    #[wasm_bindgen(getter)]
    pub fn positions(&self) -> Vec<f32> {
        self.positions.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn normals(&self) -> Vec<f32> {
        self.normals.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn indices(&self) -> Vec<u32> {
        self.indices.clone()
    }
}

impl MeshData {
    fn empty() -> Self {
        Self {
            positions: Vec::new(),
            normals: Vec::new(),
            indices: Vec::new(),
        }
    }
}

fn add(a: V3, b: V3) -> V3 {
    [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}
fn sub(a: V3, b: V3) -> V3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn scale(a: V3, s: f32) -> V3 {
    [a[0] * s, a[1] * s, a[2] * s]
}
fn cross(a: V3, b: V3) -> V3 {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn dot(a: V3, b: V3) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
fn length(a: V3) -> f32 {
    dot(a, a).sqrt()
}
fn normalize(a: V3) -> Option<V3> {
    let len = length(a);
    if len < EPSILON {
        None
    } else {
        Some(scale(a, 1.0 / len))
    }
}

/// Local path direction at each point: segment direction at the ends,
/// normalized sum of adjacent segment directions at interior joints.
/// Returns None on any degenerate (zero-length) segment.
fn point_directions(points: &[V3]) -> Option<Vec<V3>> {
    let mut segment_dirs = Vec::with_capacity(points.len() - 1);
    for pair in points.windows(2) {
        segment_dirs.push(normalize(sub(pair[1], pair[0]))?);
    }
    let mut dirs = Vec::with_capacity(points.len());
    dirs.push(segment_dirs[0]);
    for i in 1..points.len() - 1 {
        dirs.push(normalize(add(segment_dirs[i - 1], segment_dirs[i]))?);
    }
    dirs.push(segment_dirs[segment_dirs.len() - 1]);
    Some(dirs)
}

/// Orthonormal ring frame (u, v) perpendicular to dir, with u × v = dir.
/// Used ONLY for the first ring — per-ring heuristic frames flip their
/// reference axis when the path crosses the vertical threshold, twisting the
/// surface (visible kink mid-bend); subsequent rings use parallel transport.
fn ring_basis(dir: V3) -> (V3, V3) {
    let reference: V3 = if dir[1].abs() < VERTICAL_THRESHOLD {
        [0.0, 1.0, 0.0]
    } else {
        [1.0, 0.0, 0.0]
    };
    let u = normalize(cross(dir, reference)).unwrap_or([1.0, 0.0, 0.0]);
    (u, cross(dir, u))
}

/// Rodrigues' rotation formula (axis must be unit length).
fn rotate_around_axis(v: V3, axis: V3, angle: f32) -> V3 {
    let cos = angle.cos();
    let sin = angle.sin();
    add(
        add(scale(v, cos), scale(cross(axis, v), sin)),
        scale(axis, dot(axis, v) * (1.0 - cos)),
    )
}

/// Parallel transport: the previous ring frame minimally rotated from d_prev
/// to d_cur — consecutive rings never twist around the path axis.
fn transport_basis(d_prev: V3, d_cur: V3, u_prev: V3) -> (V3, V3) {
    let cos_angle = dot(d_prev, d_cur);
    if cos_angle.abs() > 1.0 - ANGLE_EPSILON {
        // Straight continuation or reversal: carry the frame over unchanged
        // (a 180° flip has no unique minimal rotation; the frame stays valid).
        return (u_prev, cross(d_cur, u_prev));
    }
    let axis = match normalize(cross(d_prev, d_cur)) {
        Some(axis) => axis,
        None => return ring_basis(d_cur),
    };
    let u = rotate_around_axis(u_prev, axis, cos_angle.acos());
    (u, cross(d_cur, u))
}

/// Ring frames along the whole path: heuristic basis for the first ring,
/// parallel transport from then on.
fn ring_frames(dirs: &[V3]) -> Vec<(V3, V3)> {
    let mut frames = Vec::with_capacity(dirs.len());
    frames.push(ring_basis(dirs[0]));
    for i in 1..dirs.len() {
        frames.push(transport_basis(dirs[i - 1], dirs[i], frames[i - 1].0));
    }
    frames
}

/// Resamples a polyline, replacing each interior vertex with a tangent arc of
/// the given centerline bend radius (mandrel radius + bar radius, per the
/// steel catalog). Sharp vertices stay when the radius is zero, the joint is
/// straight/reversing, or the adjacent segments are too short — then the
/// radius shrinks to fit half the shorter segment. Endpoints never move.
fn round_path_corners(points: &[V3], bend_radius: f32) -> Vec<V3> {
    if points.len() < 3 || bend_radius <= 0.0 {
        return points.to_vec();
    }
    let mut rounded = vec![points[0]];
    for i in 1..points.len() - 1 {
        let vertex = points[i];
        let d_in = match normalize(sub(vertex, points[i - 1])) {
            Some(dir) => dir,
            None => return points.to_vec(), // degenerate — swept_cylinder rejects it
        };
        let d_out = match normalize(sub(points[i + 1], vertex)) {
            Some(dir) => dir,
            None => return points.to_vec(),
        };
        let cos_phi = dot(d_in, d_out);
        if cos_phi.abs() > 1.0 - ANGLE_EPSILON {
            rounded.push(vertex); // straight or reversing joint — keep the miter
            continue;
        }
        let phi = cos_phi.acos(); // deflection angle between the segments
        let half = phi / 2.0;
        // Tangent length, clamped so arcs of neighbouring bends never overlap.
        let tangent = (bend_radius * half.tan())
            .min(length(sub(vertex, points[i - 1])) / 2.0)
            .min(length(sub(points[i + 1], vertex)) / 2.0);
        if tangent < EPSILON {
            rounded.push(vertex);
            continue;
        }
        let radius = tangent / half.tan();
        let t1 = sub(vertex, scale(d_in, tangent));
        // Arc center: on the inner bisector at radius / cos(φ/2) from the vertex.
        let bisector = match normalize(sub(d_out, d_in)) {
            Some(dir) => dir,
            None => {
                rounded.push(vertex);
                continue;
            }
        };
        let center = add(vertex, scale(bisector, radius / half.cos()));
        let axis = match normalize(cross(d_in, d_out)) {
            Some(dir) => dir,
            None => {
                rounded.push(vertex);
                continue;
            }
        };
        let e1 = normalize(sub(t1, center)).unwrap_or([1.0, 0.0, 0.0]);
        let e2 = cross(axis, e1);
        let steps = ((phi / std::f32::consts::FRAC_PI_2) * ARC_RINGS_PER_QUARTER_TURN as f32)
            .ceil()
            .max(1.0) as usize;
        for j in 0..=steps {
            let theta = phi * (j as f32) / (steps as f32);
            let radial = add(scale(e1, theta.cos()), scale(e2, theta.sin()));
            rounded.push(add(center, scale(radial, radius)));
        }
    }
    rounded.push(points[points.len() - 1]);
    rounded
}

/// Swept cylinder along a polyline with flat end caps.
/// Straight bar = 2 points; bent bars (3+) get mitered joints.
fn swept_cylinder(points: &[V3], radius: f32, segments: usize) -> MeshData {
    let dirs = match point_directions(points) {
        Some(dirs) => dirs,
        None => return MeshData::empty(),
    };
    let ring_count = points.len();
    let frames = ring_frames(&dirs);
    let mut positions = Vec::with_capacity((ring_count * segments + 2) * 3);
    let mut normals = Vec::with_capacity(positions.capacity());
    let mut indices: Vec<u32> = Vec::new();

    // Rings: vertex = point + radius * (cos·u + sin·v), normal = radial direction.
    for (i, point) in points.iter().enumerate() {
        let (u, v) = frames[i];
        for j in 0..segments {
            let theta = std::f32::consts::TAU * (j as f32) / (segments as f32);
            let offset = add(scale(u, theta.cos()), scale(v, theta.sin()));
            positions.extend_from_slice(&add(*point, scale(offset, radius)));
            normals.extend_from_slice(&offset);
        }
    }

    // Side quads — wound so the face normal points away from the axis.
    for i in 0..ring_count - 1 {
        for j in 0..segments {
            let j_next = (j + 1) % segments;
            let a = (i * segments + j) as u32;
            let b = (i * segments + j_next) as u32;
            let c = ((i + 1) * segments + j) as u32;
            let d = ((i + 1) * segments + j_next) as u32;
            indices.extend_from_slice(&[a, b, c]);
            indices.extend_from_slice(&[b, d, c]);
        }
    }

    // Flat end caps: one center vertex each + triangle fan.
    let start_center = (ring_count * segments) as u32;
    positions.extend_from_slice(&points[0]);
    normals.extend_from_slice(&scale(dirs[0], -1.0));
    let end_center = start_center + 1;
    positions.extend_from_slice(&points[ring_count - 1]);
    normals.extend_from_slice(&dirs[ring_count - 1]);

    let last_ring_base = ((ring_count - 1) * segments) as u32;
    for j in 0..segments {
        let j_next = ((j + 1) % segments) as u32;
        indices.extend_from_slice(&[start_center, j_next, j as u32]);
        indices.extend_from_slice(&[
            end_center,
            last_ring_base + j as u32,
            last_ring_base + j_next,
        ]);
    }

    MeshData {
        positions,
        normals,
        indices,
    }
}

/// §D.3 boundary function: flat path array in, typed mesh arrays out.
/// `path_points` = flat [x1,y1,z1, x2,y2,z2, ...] in mm; `diameter` in mm;
/// `segments` = cylinder radial resolution (§L.3 LOD: 20 near, fewer far);
/// `bend_radius` = centerline arc radius at interior vertices (mm, catalog
/// mandrel radius + bar radius; 0 = sharp mitered joints).
/// Degenerate input (not enough points, zero-length segment, bad diameter)
/// returns an empty mesh — validation upstream (commands) prevents this.
#[wasm_bindgen]
pub fn generate_bar_mesh(path_points: &[f64], diameter: f64, segments: u32, bend_radius: f64) -> MeshData {
    if path_points.len() % 3 != 0 || path_points.len() < 6 || diameter <= 0.0 || segments < MIN_SEGMENTS {
        return MeshData::empty();
    }
    let points: Vec<V3> = path_points
        .chunks_exact(3)
        .map(|c| [c[0] as f32, c[1] as f32, c[2] as f32])
        .collect();
    let rounded = round_path_corners(&points, bend_radius as f32);
    swept_cylinder(&rounded, (diameter / 2.0) as f32, segments as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn straight_x_bar(segments: usize) -> MeshData {
        swept_cylinder(&[[0.0, 0.0, 0.0], [1000.0, 0.0, 0.0]], 8.0, segments)
    }

    #[test]
    fn vertex_and_index_counts() {
        let mesh = straight_x_bar(8);
        // 2 rings × 8 + 2 cap centers = 18 vertices → 54 floats
        assert_eq!(mesh.positions.len(), 18 * 3);
        assert_eq!(mesh.normals.len(), 18 * 3);
        // sides 2 tris × 8 quads + caps 2 fans × 8 tris = 32 tris → 96 indices
        assert_eq!(mesh.indices.len(), 32 * 3);
    }

    #[test]
    fn ring_vertices_sit_at_radius_from_axis() {
        let mesh = straight_x_bar(8);
        for v in mesh.positions.chunks_exact(3).take(16) {
            let radial = (v[1] * v[1] + v[2] * v[2]).sqrt();
            assert!((radial - 8.0).abs() < 1e-4, "radial distance {radial}");
        }
    }

    #[test]
    fn ring_normals_are_unit_and_radial() {
        let mesh = straight_x_bar(8);
        for n in mesh.normals.chunks_exact(3).take(16) {
            let len = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt();
            assert!((len - 1.0).abs() < 1e-6);
            assert!(n[0].abs() < 1e-6, "normal must be perpendicular to axis");
        }
    }

    #[test]
    fn degenerate_inputs_yield_empty_mesh() {
        assert!(generate_bar_mesh(&[], 16.0, 20, 30.0).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0], 16.0, 20, 30.0).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 16.0, 20, 30.0).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0, 1.0, 0.0, 0.0], 0.0, 20, 30.0).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0, 1.0, 0.0, 0.0], 16.0, 2, 30.0).positions.is_empty());
    }

    #[test]
    fn bent_bar_gets_mitered_middle_ring() {
        // L-shaped path: 3 points → 3 rings + 2 cap centers = 20 vertices at segments 6
        let mesh = swept_cylinder(
            &[[0.0, 0.0, 0.0], [500.0, 0.0, 0.0], [500.0, 500.0, 0.0]],
            8.0,
            6,
        );
        assert_eq!(mesh.positions.len(), 20 * 3);
    }

    #[test]
    fn rounding_pulls_tangent_points_back_by_the_radius_at_90_degrees() {
        // L path, 90° bend at (500,0,0), radius 25: tan(45°) = 1 → tangent = 25.
        let rounded = round_path_corners(
            &[[0.0, 0.0, 0.0], [500.0, 0.0, 0.0], [500.0, 500.0, 0.0]],
            25.0,
        );
        // 1 start + 7 arc rings (6 steps per quarter turn) + 1 end
        assert_eq!(rounded.len(), 9);
        assert_eq!(rounded[0], [0.0, 0.0, 0.0]); // endpoints never move
        assert_eq!(rounded[8], [500.0, 500.0, 0.0]);
        assert!((rounded[1][0] - 475.0).abs() < 1e-3, "T1 x = {}", rounded[1][0]);
        assert!(rounded[1][1].abs() < 1e-3);
        assert!((rounded[7][0] - 500.0).abs() < 1e-3, "T2 x = {}", rounded[7][0]);
        assert!((rounded[7][1] - 25.0).abs() < 1e-3, "T2 y = {}", rounded[7][1]);
        // Arc midpoint (45°) sits on the arc: distance from the bend center
        // (475, 25, 0) equals the radius.
        let mid = rounded[4];
        let center = [475.0_f32, 25.0, 0.0];
        assert!((length(sub(mid, center)) - 25.0).abs() < 1e-3);
    }

    #[test]
    fn zero_radius_keeps_sharp_corners() {
        let path = [[0.0, 0.0, 0.0], [500.0, 0.0, 0.0], [500.0, 500.0, 0.0]];
        assert_eq!(round_path_corners(&path, 0.0), path.to_vec());
    }

    #[test]
    fn short_segments_shrink_the_radius_instead_of_overlapping() {
        // Two 90° bends 40 mm apart, radius 25: the tangent wants 25 mm per
        // side but only 40/2 = 20 mm are available → the radius shrinks to 20.
        let rounded = round_path_corners(
            &[
                [0.0, 0.0, 0.0],
                [500.0, 0.0, 0.0],
                [500.0, 40.0, 0.0],
                [1000.0, 40.0, 0.0],
            ],
            25.0,
        );
        // Bend 1 arc starts at 500 − 20 = 480; bend 2 arc ends at 500 + 20 = 520.
        let first_arc_start = rounded[1];
        assert!((first_arc_start[0] - 480.0).abs() < 1e-3, "x = {}", first_arc_start[0]);
        let last_arc_end = rounded[rounded.len() - 2];
        assert!((last_arc_end[0] - 520.0).abs() < 1e-3, "x = {}", last_arc_end[0]);
    }

    #[test]
    fn ring_frames_do_not_twist_across_a_vertical_bend() {
        // Vertical → horizontal 90° bend: the direction crosses the ring_basis
        // reference threshold mid-arc. The old per-ring heuristic flipped the
        // frame there and sheared the surface into a visible kink (author
        // screenshot, T8 review); parallel transport must stay continuous.
        let rounded = round_path_corners(
            &[[0.0, 0.0, 0.0], [0.0, 500.0, 0.0], [500.0, 500.0, 0.0]],
            25.0,
        );
        let dirs = point_directions(&rounded).expect("valid arc path");
        let frames = ring_frames(&dirs);
        for pair in frames.windows(2) {
            assert!(
                dot(pair[0].0, pair[1].0) > 0.9,
                "frame twist between consecutive rings"
            );
        }
    }

    #[test]
    fn bent_bar_with_radius_renders_more_rings() {
        // Same L path as the miter test, but through generate_bar_mesh with a
        // radius: 1 + 7 + 1 = 9 rings × 6 segments + 2 cap centers = 56 verts.
        let mesh = generate_bar_mesh(
            &[0.0, 0.0, 0.0, 500.0, 0.0, 0.0, 500.0, 500.0, 0.0],
            16.0,
            6,
            25.0,
        );
        assert_eq!(mesh.positions.len(), 56 * 3);
    }
}
