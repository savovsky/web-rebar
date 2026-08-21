/**
 * Reinforcement bar model (§C, §F). Stores design intent (cover distance,
 * steel grade) — not just resulting geometry — so bars can be re-generated
 * and validated later. Dimensions in millimetres.
 */
import type { Vec3 } from './geometry';

export interface ReinforcementBar {
  id: string;
  /** Element this bar belongs to (M0: a wall). Bars follow host element moves/copies —
   *  computed once inside the same command transaction (§E, revised 2026-08-09). */
  hostElementId: string;
  /** Bar diameter (mm) — must exist in the active steel catalog (§K.3). */
  diameter: number;
  /**
   * Centerline path in model space. Chained placement (§B.6) produces ONE bar
   * with several segments — intermediate points are bending places, and the
   * bar stays a single position for the schedule (§J) and bar counts.
   */
  path: Vec3[];
  /** Concrete cover this bar was placed with (mm) — stored intent, not derived. */
  coverDistance: number;
  /** Steel grade catalog key, e.g. 'B500B'. */
  steelGrade: string;
  /**
   * Position number (§J schedule handle — landed at M3 T1 per plan Q7-a; the
   *  "arrives with §J" placeholder comment resolved 2026-08-21): groups give
   *  all their generated bars ONE shared mark (the PlacementGroup.barMark);
   *  individual bars take the next free mark from the project counter at
   *  placement. User-editing of marks stays §J scope.
   */
  barMark: number;
  /**
   * Parent placement group (§F.2, M3) — the Q6 detach handle: moveBar clears
   *  this when a group member is dragged out of the rule (the group's `bars`
   *  list is updated in the same command). Individuals and Q6-detached bars
   *  leave it undefined.
   */
  placementGroupId?: string;
}
