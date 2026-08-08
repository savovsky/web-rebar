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
fn normalize(a: V3) -> Option<V3> {
    let len = (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]).sqrt();
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
fn ring_basis(dir: V3) -> (V3, V3) {
    let reference: V3 = if dir[1].abs() < VERTICAL_THRESHOLD {
        [0.0, 1.0, 0.0]
    } else {
        [1.0, 0.0, 0.0]
    };
    let u = normalize(cross(dir, reference)).unwrap_or([1.0, 0.0, 0.0]);
    (u, cross(dir, u))
}

/// Swept cylinder along a polyline with flat end caps.
/// Straight bar = 2 points; bent bars (3+) get mitered joints.
fn swept_cylinder(points: &[V3], radius: f32, segments: usize) -> MeshData {
    let dirs = match point_directions(points) {
        Some(dirs) => dirs,
        None => return MeshData::empty(),
    };
    let ring_count = points.len();
    let mut positions = Vec::with_capacity((ring_count * segments + 2) * 3);
    let mut normals = Vec::with_capacity(positions.capacity());
    let mut indices: Vec<u32> = Vec::new();

    // Rings: vertex = point + radius * (cos·u + sin·v), normal = radial direction.
    for (i, point) in points.iter().enumerate() {
        let (u, v) = ring_basis(dirs[i]);
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
/// `segments` = cylinder radial resolution (§L.3 LOD: 20 near, fewer far).
/// Degenerate input (not enough points, zero-length segment, bad diameter)
/// returns an empty mesh — validation upstream (commands) prevents this.
#[wasm_bindgen]
pub fn generate_bar_mesh(path_points: &[f64], diameter: f64, segments: u32) -> MeshData {
    if path_points.len() % 3 != 0 || path_points.len() < 6 || diameter <= 0.0 || segments < MIN_SEGMENTS {
        return MeshData::empty();
    }
    let points: Vec<V3> = path_points
        .chunks_exact(3)
        .map(|c| [c[0] as f32, c[1] as f32, c[2] as f32])
        .collect();
    swept_cylinder(&points, (diameter / 2.0) as f32, segments as usize)
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
        assert!(generate_bar_mesh(&[], 16.0, 20).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0], 16.0, 20).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.0], 16.0, 20).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0, 1.0, 0.0, 0.0], 0.0, 20).positions.is_empty());
        assert!(generate_bar_mesh(&[0.0, 0.0, 0.0, 1.0, 0.0, 0.0], 16.0, 2).positions.is_empty());
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
}
