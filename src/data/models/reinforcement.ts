/**
 * Reinforcement bar model (§C, §F). Stores design intent (cover distance,
 * steel grade) — not just resulting geometry — so bars can be re-generated
 * and validated later. Dimensions in millimetres.
 */
import type { Vec3 } from './geometry';

export interface ReinforcementBar {
  id: string;
  /** Element this bar belongs to (M0: a wall). Bars do not auto-follow host moves (§E). */
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
  // barMark (position number for the schedule) arrives with §J — post-M0.
}
