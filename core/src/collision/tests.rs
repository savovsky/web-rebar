//! Corpus for the clash engine — the ANALYTIC REFERENCE the M3 Q2 spike
//! probed parry3d-f64 against lives here (Ericson's closest-point
//! parameterization, degenerate-safe), pinned against closed-form cases;
//! the corpus agreement test (gate criterion i, 1e-6 mm) stays as a
//! permanent regression pin between the shipped parry primitive and this
//! reference. Then: bar-pair behavior, pre-filter correctness, determinism,
//! invalid-input guards, and the 1,000-bar timing probe (gate criterion iii).

use super::*;

// --- the M3 Q2 analytic reference (test-only; the fallback that was not
// needed — parry3d-f64 PASSED the gate, doc 09 verdict 2026-08-22) ---

const DEGENERATE_LEN_SQ: f64 = 1e-12;

fn dot3(a: Point3, b: Point3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// Exact minimum distance between two segments — Ericson's closest-point
/// parameterization with clamping; degenerate segments fall back to
/// point–segment / point–point distance. Kept as the gate's reference and
/// the documented pure-math fallback implementation (plan Q2).
fn segment_segment_distance(p1: Point3, q1: Point3, p2: Point3, q2: Point3) -> f64 {
    let sub = |a: Point3, b: Point3| [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    let madd = |origin: Point3, dir: Point3, t: f64| {
        [
            dir[0].mul_add(t, origin[0]),
            dir[1].mul_add(t, origin[1]),
            dir[2].mul_add(t, origin[2]),
        ]
    };
    let norm = |v: Point3| dot3(v, v).sqrt();
    let d1 = sub(q1, p1);
    let d2 = sub(q2, p2);
    let r = sub(p1, p2);
    let a = dot3(d1, d1);
    let e = dot3(d2, d2);
    let f = dot3(d2, r);

    if a <= DEGENERATE_LEN_SQ && e <= DEGENERATE_LEN_SQ {
        return norm(r);
    }
    let (mut s, t);
    if a <= DEGENERATE_LEN_SQ {
        s = 0.0;
        t = (f / e).clamp(0.0, 1.0);
    } else if e <= DEGENERATE_LEN_SQ {
        t = 0.0;
        s = (-dot3(d1, r) / a).clamp(0.0, 1.0);
    } else {
        let b = dot3(d1, d2);
        let c = dot3(d1, r);
        let denominator = a.mul_add(e, -(b * b));
        s = if denominator > DEGENERATE_LEN_SQ {
            (b.mul_add(f, -(c * e)) / denominator).clamp(0.0, 1.0)
        } else {
            // Parallel segments — any s works; 0 keeps the t search honest.
            0.0
        };
        let t_numerator = b.mul_add(s, f);
        if t_numerator < 0.0 {
            t = 0.0;
            s = (-c / a).clamp(0.0, 1.0);
        } else if t_numerator > e {
            t = 1.0;
            s = ((b - c) / a).clamp(0.0, 1.0);
        } else {
            t = t_numerator / e;
        }
    }
    norm(sub(madd(p1, d1, s), madd(p2, d2, t)))
}

// --- gate criterion (i): the shipped parry primitive vs this reference ---

const GATE_TOLERANCE_MM: f64 = 1e-6;

fn assert_gate_agrees(p1: Point3, q1: Point3, p2: Point3, q2: Point3) {
    let reference = segment_segment_distance(p1, q1, p2, q2);
    let shipped = centerline_segment_distance(p1, q1, p2, q2);
    assert!(
        (reference - shipped).abs() <= GATE_TOLERANCE_MM,
        "gate mismatch: reference {reference} vs shipped {shipped} for {p1:?}-{q1:?} / {p2:?}-{q2:?}"
    );
}

/// SplitMix-style LCG — deterministic across platforms and runs.
struct Lcg(u64);

impl Lcg {
    /// Uniform f64 in [0, 1) — the top 32 bits, exactly representable
    /// (u32 → f64 never loses precision, so the pedantic cast lints stay silent).
    fn next_f64(&mut self) -> f64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1_442_695_040_888_963_407);
        let bits = u32::try_from(self.0 >> 32).unwrap_or(u32::MAX);
        f64::from(bits) / 4_294_967_296.0
    }

    /// Uniform coordinate in ±spread mm around 0.
    fn coord(&mut self, spread: f64) -> f64 {
        (self.next_f64() * 2.0 - 1.0) * spread
    }
}

#[test]
fn structured_corpus_matches_the_analytic_reference() {
    // Parallel (offset on each axis), crossing (0), skew at right angle,
    // endpoint-clamped skew, collinear-overlapping (0), near-parallel.
    let cases: [(Point3, Point3, Point3, Point3); 8] = [
        (
            [0.0, 0.0, 0.0],
            [1000.0, 0.0, 0.0],
            [0.0, 100.0, 0.0],
            [1000.0, 100.0, 0.0],
        ),
        (
            [0.0, 0.0, 0.0],
            [1000.0, 0.0, 0.0],
            [500.0, -500.0, 0.0],
            [500.0, 500.0, 0.0],
        ),
        (
            [0.0, 0.0, 0.0],
            [1000.0, 0.0, 0.0],
            [500.0, -500.0, 35.0],
            [500.0, 500.0, 35.0],
        ),
        (
            [0.0, 0.0, 0.0],
            [1000.0, 0.0, 0.0],
            [1400.0, 300.0, 300.0],
            [1400.0, -300.0, 300.0],
        ),
        (
            [0.0, 0.0, 0.0],
            [1000.0, 0.0, 0.0],
            [2000.0, 0.0, 0.0],
            [3000.0, 0.0, 0.0],
        ),
        (
            [0.0, 0.0, 700.0],
            [3000.0, 0.0, 700.0],
            [0.0, 8.0, 700.0],
            [3000.0, 8.0, 700.0],
        ),
        // Near-parallel (0.1°) skew — the ill-conditioned denominator case.
        (
            [0.0, 0.0, 0.0],
            [1000.0, 1.745, 0.0],
            [120.0, 40.0, 13.7],
            [890.0, 42.3, 15.1],
        ),
        // Bent-bar scale: long coordinates, small distances (mm precision at
        // building scale — the 1e-6 criterion's hard case).
        (
            [12_345.6, 7_890.1, 2_345.0],
            [16_789.0, 7_890.1, 2_345.0],
            [12_345.6, 7_898.1, 2_345.0],
            [16_789.0, 7_898.1, 2_345.0],
        ),
    ];
    for (p1, q1, p2, q2) in cases {
        assert_gate_agrees(p1, q1, p2, q2);
    }
}

#[test]
fn randomized_skew_corpus_matches_the_analytic_reference() {
    let mut rng = Lcg(0x5EED_2026_0822);
    for _ in 0..500 {
        // Room-scale clouds (±6 m) — the mixed near/far regime.
        let pick = |rng: &mut Lcg| [rng.coord(6000.0), rng.coord(6000.0), rng.coord(3000.0)];
        assert_gate_agrees(
            pick(&mut rng),
            pick(&mut rng),
            pick(&mut rng),
            pick(&mut rng),
        );
    }
}

#[test]
fn randomized_bent_bar_corpus_matches_on_polylines() {
    // Bent bars (3–5 points): polyline min distance over all segment pairs,
    // shipped vs reference — the Q2 corpus's bent-bar half.
    let mut rng = Lcg(0xBE17_2026_0822);
    for _ in 0..120 {
        let polyline = |rng: &mut Lcg, points: usize| {
            (0..points)
                .map(|_| [rng.coord(4000.0), rng.coord(4000.0), rng.coord(2800.0)])
                .collect::<Vec<Point3>>()
        };
        let bar_a = polyline(&mut rng, 3);
        let bar_b = polyline(&mut rng, 5);
        let reference = {
            let mut min = f64::INFINITY;
            for segment_a in bar_a.windows(2) {
                for segment_b in bar_b.windows(2) {
                    min = min.min(segment_segment_distance(
                        segment_a[0],
                        segment_a[1],
                        segment_b[0],
                        segment_b[1],
                    ));
                }
            }
            min
        };
        let shipped = polyline_distance(&bar_a, &bar_b, f64::INFINITY);
        assert!(
            (reference - shipped).abs() <= GATE_TOLERANCE_MM,
            "bent-bar gate mismatch: reference {reference} vs shipped {shipped}"
        );
    }
}

/// One straight bar as a flat path + offset pair — test builder.
fn one_bar(path: &[f64]) -> (Vec<f64>, Vec<u32>) {
    (
        path.to_vec(),
        vec![
            0,
            u32::try_from(path.len() / COMPONENTS_PER_POINT).unwrap_or(0),
        ],
    )
}

fn run(bars: &[&[f64]], radii: &[f64]) -> (Vec<u32>, Vec<f64>) {
    let mut points = Vec::new();
    let mut offsets = vec![0_u32];
    for bar in bars {
        points.extend_from_slice(bar);
        offsets.push(u32::try_from(points.len() / COMPONENTS_PER_POINT).unwrap_or(0));
    }
    let report = check_bar_collisions(&points, &offsets, radii);
    (report.pairs(), report.distances())
}

// --- segment–segment distance: hand-computed reference cases ---

#[test]
fn parallel_segments_keep_their_perpendicular_distance() {
    let distance = segment_segment_distance(
        [0.0, 0.0, 0.0],
        [1000.0, 0.0, 0.0],
        [0.0, 100.0, 0.0],
        [1000.0, 100.0, 0.0],
    );
    assert_eq!(distance, 100.0);
}

#[test]
fn crossing_segments_have_zero_distance() {
    let distance = segment_segment_distance(
        [0.0, 0.0, 0.0],
        [1000.0, 0.0, 0.0],
        [500.0, -500.0, 0.0],
        [500.0, 500.0, 0.0],
    );
    assert_eq!(distance, 0.0);
}

#[test]
fn skew_segments_at_right_angle_keep_their_elevation_gap() {
    // Along X at z = 0 vs along Y at z = 35, plan-crossing at (500, 0).
    let distance = segment_segment_distance(
        [0.0, 0.0, 0.0],
        [1000.0, 0.0, 0.0],
        [500.0, -500.0, 35.0],
        [500.0, 500.0, 35.0],
    );
    assert_eq!(distance, 35.0);
}

#[test]
fn skew_distance_clamps_to_the_closest_endpoints() {
    // Short segment hovering past the END of a long one: the closest pair is
    // (1000,0,0) on the long segment ↔ (1400,0,300) on the short one —
    // distance √(400² + 300²) = 500 exactly.
    let distance = segment_segment_distance(
        [0.0, 0.0, 0.0],
        [1000.0, 0.0, 0.0],
        [1400.0, 300.0, 300.0],
        [1400.0, -300.0, 300.0],
    );
    assert_eq!(distance, 500.0);
}

#[test]
fn degenerate_segments_fall_back_to_point_distance() {
    // Defensive only (commands reject zero-length segments): point vs segment.
    let distance = segment_segment_distance(
        [0.0, 0.0, 0.0],
        [1000.0, 0.0, 0.0],
        [500.0, 0.0, 60.0],
        [500.0, 0.0, 60.0],
    );
    assert_eq!(distance, 60.0);
    let point_point = segment_segment_distance(
        [1.0, 2.0, 2.0],
        [1.0, 2.0, 2.0],
        [4.0, 6.0, 2.0],
        [4.0, 6.0, 2.0],
    );
    assert_eq!(point_point, 5.0);
}

// --- bar pairs: clash criterion (centerline distance < r₁ + r₂) ---

#[test]
fn overlapping_parallel_bars_clash_with_the_exact_distance() {
    // Two Ø12 bars (r 6 + 6 = 12): 8 mm apart → clash at 8.0 exactly.
    let bar_a = [0.0, 0.0, 700.0, 3000.0, 0.0, 700.0];
    let bar_b = [0.0, 0.0, 708.0, 3000.0, 0.0, 708.0];
    let (pairs, distances) = run(&[&bar_a, &bar_b], &[6.0, 6.0]);
    assert_eq!(pairs, vec![0, 1]);
    assert_eq!(distances, vec![8.0]);
}

#[test]
fn touching_exactly_is_not_a_clash() {
    // Distance == r₁ + r₂ exactly → surfaces kiss, no intersection (strict <).
    let bar_a = [0.0, 0.0, 700.0, 3000.0, 0.0, 700.0];
    let bar_b = [0.0, 0.0, 712.0, 3000.0, 0.0, 712.0];
    let (pairs, distances) = run(&[&bar_a, &bar_b], &[6.0, 6.0]);
    assert!(pairs.is_empty());
    assert!(distances.is_empty());
}

#[test]
fn crossing_bars_clash_at_zero_distance() {
    let bar_a = [0.0, 0.0, 700.0, 3000.0, 0.0, 700.0];
    let bar_b = [1500.0, -100.0, 700.0, 1500.0, 100.0, 700.0];
    let (pairs, distances) = run(&[&bar_a, &bar_b], &[6.0, 6.0]);
    assert_eq!(pairs, vec![0, 1]);
    assert_eq!(distances, vec![0.0]);
}

#[test]
fn bent_bar_clashes_through_its_middle_segment() {
    // L-shaped bar: along X then down Z; the vertical leg passes 5 mm from a
    // straight bar along Y — the clash distance comes from the SECOND segment.
    let bent = [0.0, 0.0, 700.0, 3000.0, 0.0, 700.0, 3000.0, 0.0, 100.0];
    let straight = [2900.0, -500.0, 695.0, 2900.0, 500.0, 695.0];
    let (pairs, distances) = run(&[&bent, &straight], &[6.0, 6.0]);
    assert_eq!(pairs, vec![0, 1]);
    assert_eq!(distances, vec![5.0]);
}

#[test]
fn distant_bars_are_skipped_by_the_prefilter() {
    // Same shape as the clash case but 2 m away in plan — no exact pass runs.
    let bar_a = [0.0, 0.0, 700.0, 3000.0, 0.0, 700.0];
    let bar_b = [0.0, 2000.0, 708.0, 3000.0, 2000.0, 708.0];
    let (pairs, _) = run(&[&bar_a, &bar_b], &[6.0, 6.0]);
    assert!(pairs.is_empty());
}

#[test]
fn pair_order_is_deterministic_ascending() {
    // Three mutually clashing bars → pairs (0,1), (0,2), (1,2) in that order.
    let bar_a = [0.0, 0.0, 700.0, 3000.0, 0.0, 700.0];
    let bar_b = [0.0, 0.0, 704.0, 3000.0, 0.0, 704.0];
    let bar_c = [1500.0, -100.0, 702.0, 1500.0, 100.0, 702.0];
    let (pairs, distances) = run(&[&bar_a, &bar_b, &bar_c], &[6.0, 6.0, 6.0]);
    assert_eq!(pairs, vec![0, 1, 0, 2, 1, 2]);
    assert_eq!(distances, vec![4.0, 2.0, 2.0]);
}

#[test]
fn the_prefilter_does_not_change_results_at_reference_scale() {
    // 1,000-bar all-pairs shape (the M3 T7 budget probe's corpus): a 10×10×10
    // grid of straight bars 150 mm apart — no clashes (150 ≫ Ø12) except the
    // two planted crossing pairs. Exactness is asserted; timing is printed
    // for the T6 gate record (T7 arms the regression tripwire).
    let spacing = 150.0;
    let mut bars: Vec<Vec<f64>> = Vec::new();
    for gx in 0..10 {
        for gy in 0..10 {
            for gz in 0..10 {
                let base = |g: i32| f64::from(g) * spacing;
                bars.push(vec![
                    base(gx),
                    base(gy),
                    base(gz),
                    base(gx) + 100.0,
                    base(gy),
                    base(gz),
                ]);
            }
        }
    }
    assert_eq!(bars.len(), 1000);
    // Planted clashes: bar 0 duplicated at 4 mm in z; a short crossing bar at
    // x = 800, z = 2 hits exactly bar 500 (gx=5, gy=0, gz=0 → (750,0,0)–
    // (850,0,0)). All grid neighbors are ≥ 50 mm away (150 spacing, 100
    // length) — no accidental clashes with r₁ + r₂ = 12.
    let mut planted_a = bars[0].clone();
    for point in planted_a.chunks_exact_mut(COMPONENTS_PER_POINT) {
        point[2] += 4.0;
    }
    let planted_index = u32::try_from(bars.len()).unwrap_or(0);
    bars.push(planted_a);
    let crosser_index = u32::try_from(bars.len()).unwrap_or(0);
    bars.push(vec![800.0, -50.0, 2.0, 800.0, 50.0, 2.0]);
    let radii = vec![6.0; bars.len()];
    let flat: Vec<f64> = bars.iter().flatten().copied().collect();
    let mut offsets = vec![0_u32];
    for bar in &bars {
        let points = u32::try_from(bar.len() / COMPONENTS_PER_POINT).unwrap_or(0);
        offsets.push(offsets.last().copied().unwrap_or(0) + points);
    }
    let start = std::time::Instant::now();
    let report = check_bar_collisions(&flat, &offsets, &radii);
    let elapsed = start.elapsed();
    eprintln!(
        "T6 gate probe: 1,000-bar grid + 2 planted clash bars ({} bars, all-pairs with prefilter) took {elapsed:?}",
        bars.len()
    );
    assert_eq!(report.pairs(), vec![0, planted_index, 500, crosser_index]);
    assert_eq!(report.distances(), vec![4.0, 2.0]);
}

#[test]
fn invalid_input_yields_an_empty_report() {
    let bar = [0.0, 0.0, 0.0, 1000.0, 0.0, 0.0];
    let (_, offsets) = one_bar(&bar);
    // Ragged points, mismatched radii, zero radius, single-point bar,
    // non-finite coordinate, unsorted offsets.
    assert!(run(&[&bar], &[0.0]).0.is_empty());
    assert!(run(&[&bar], &[f64::NAN]).0.is_empty());
    assert!(check_bar_collisions(&bar[..5], &offsets, &[6.0])
        .pairs()
        .is_empty());
    assert!(check_bar_collisions(&bar, &offsets, &[6.0, 6.0])
        .pairs()
        .is_empty());
    let single_point = [3.0, 3.0, 3.0];
    assert!(run(&[&single_point], &[6.0]).0.is_empty());
    let non_finite = [0.0, 0.0, f64::INFINITY, 1.0, 1.0, 1.0];
    assert!(run(&[&non_finite], &[6.0]).0.is_empty());
    assert!(check_bar_collisions(&bar, &[2, 0], &[6.0])
        .pairs()
        .is_empty());
}
