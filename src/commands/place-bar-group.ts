// §N command: place a bar GROUP (§F.2, M3 plan Q1-a/Q3-a/Q7-a) — a stored
// placement rule over a host-local face region whose bars are generated
// rule-exactly by the T2 orchestration (generateBarGroupPaths). One shared
// barMark from the project counter per Q7-a; ONE undo level (the T1 batch
// addBars + group reducer + setNextBarMark bump join the command scope, the
// placeBar precedent). T6 (Q8, §K.4): the clash check runs over the new bars
// against the PROSPECTIVE model (pre-dispatch, pure) and the exact report
// rides the command result — placement is NON-BLOCKING, nothing is
// auto-moved (the §K "Fit to Code" door stays closed).
import { DEFAULT_DIAMETERS, DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import {
  ELEMENT_FACE_KEYS,
  type ElementFaceKey,
  type FaceRegion,
  type PlacementGroup,
  type ReinforcementBar,
  type Vec3,
} from '@/data/models';
import { type BarClash, findBarClashes } from '@/engine/collision';
import { generateBarGroupPaths } from '@/engine/placement-group';
import type { AppThunk } from '@/stores';
import { addBars, addPlacementGroup, setNextBarMark } from '@/stores/project-slice';
import { CommandError } from './command-error';
import { resolveDefaultCover } from './place-bar';

export interface PlaceBarGroupParams {
  /** Element the group is hosted on (M3: a wall). Must exist. */
  hostElementId: string;
  /** Stable host-local face key (Q3-a) — validated against the T1 runtime list. */
  faceKey: ElementFaceKey;
  /** Face-local (u,v) region rectangle. */
  region: FaceRegion;
  /** Bar diameter (mm) — must exist in the steel catalog (§K.3). */
  diameter: number;
  /** Concrete cover (mm); defaults to the catalog default for the host kind
   *  (the placeBar convention — the stored rule keeps the resolved value). */
  coverDistance?: number;
  /** mm center-to-center along the spacing axis. */
  barSpacing: number;
  /** mm from the region edge along the spacing axis (start side). */
  edgeDistanceStart: number;
  /** mm from the region edge along the spacing axis (end side). */
  edgeDistanceEnd: number;
  /** 'horizontal' = bars run along the face u axis (spaced along v);
   *  'vertical' = run along v (spaced along u). */
  orientation: 'horizontal' | 'vertical';
}

export interface PlaceBarGroupResult {
  groupId: string;
  /** Generated bar ids in layout order (the group's membership list). */
  barIds: string[];
  /** Exact clash report (Q8, §K.4 — non-blocking): pairs involving the new
   *  bars, sorted by id; empty when nothing clashes. */
  clashes: BarClash[];
}

/** Shared validation for group placement AND regenerate (the T3 doorway):
 *  catalog Ø, runtime orientation, positive cover. Region/spacing/edge/cover-
 *  fit sanity lives in the T2 orchestration — its Error throws are mapped to
 *  CommandError('INVALID_PARAMS') by the caller (input validation in the §N
 *  doorway, not §K code-compliance — the plan door check). */
export function validateGroupRule(rule: {
  diameter: number;
  coverDistance: number;
  orientation: string;
}): void {
  if (!DEFAULT_DIAMETERS.includes(rule.diameter)) {
    throw new CommandError('INVALID_PARAMS', `group rule: Ø${rule.diameter} not in steel catalog`);
  }
  if (rule.orientation !== 'horizontal' && rule.orientation !== 'vertical') {
    throw new CommandError('INVALID_PARAMS', `group rule: unknown orientation: ${rule.orientation}`);
  }
  if (rule.coverDistance <= 0) {
    throw new CommandError('INVALID_PARAMS', `group rule: cover must be > 0, got ${rule.coverDistance}`);
  }
}

/** Maps the T2 orchestration's validation Errors to the §N failure type. */
export function generateRulePaths(params: {
  commandName: string;
  host: Parameters<typeof generateBarGroupPaths>[0]['host'];
  faceKey: ElementFaceKey;
  region: FaceRegion;
  coverMm: number;
  diameterMm: number;
  spacingMm: number;
  edgeDistanceStartMm: number;
  edgeDistanceEndMm: number;
  orientation: 'horizontal' | 'vertical';
}): Vec3[][] {
  try {
    return generateBarGroupPaths(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CommandError('INVALID_PARAMS', `${params.commandName}: ${message}`);
  }
}

/**
 * Places the group and its generated bars in ONE command scope → exactly ONE
 * undo level removes group + bars (milestone acceptance sentence 1); redo
 * re-applies. Returns the group id and the generated bar ids.
 */
export const placeBarGroup =
  (params: PlaceBarGroupParams): AppThunk<PlaceBarGroupResult> =>
  (dispatch, getState) => {
    const state = getState();
    const host = state.project.elements[params.hostElementId];
    if (!host) {
      throw new CommandError('NOT_FOUND', `placeBarGroup: host element not found: ${params.hostElementId}`);
    }
    if (!ELEMENT_FACE_KEYS.includes(params.faceKey)) {
      throw new CommandError(
        'INVALID_PARAMS',
        `placeBarGroup: unknown face key: ${params.faceKey as string}`,
      );
    }
    const coverDistance = params.coverDistance ?? resolveDefaultCover(host.kind);
    validateGroupRule({
      diameter: params.diameter,
      coverDistance,
      orientation: params.orientation,
    });

    const paths = generateRulePaths({
      commandName: 'placeBarGroup',
      host,
      faceKey: params.faceKey,
      region: params.region,
      coverMm: coverDistance,
      diameterMm: params.diameter,
      spacingMm: params.barSpacing,
      edgeDistanceStartMm: params.edgeDistanceStart,
      edgeDistanceEndMm: params.edgeDistanceEnd,
      orientation: params.orientation,
    });
    if (paths.length === 0) {
      // Defensive: the T2 validation rejects the zero-bar case before WASM —
      // a rule that still produces nothing is invalid input, not an empty placement.
      throw new CommandError('INVALID_PARAMS', 'placeBarGroup: the rule produced no bars');
    }

    // Q7-a: ONE mark for ALL generated bars from the project counter; the
    // counter bump joins this command's scope (ONE undo level). Group bars
    // take the catalog default steel grade — the §F.2 rule carries no grade
    // (recorded in the T3 task log).
    const barMark = state.project.nextBarMark;
    const groupId = crypto.randomUUID();
    const bars: ReinforcementBar[] = paths.map((path) => ({
      id: crypto.randomUUID(),
      hostElementId: params.hostElementId,
      diameter: params.diameter,
      path,
      coverDistance,
      steelGrade: DEFAULT_STEEL_CATALOG.defaultGrade,
      barMark,
      placementGroupId: groupId,
    }));
    const group: PlacementGroup = {
      id: groupId,
      hostElementId: params.hostElementId,
      faceKey: params.faceKey,
      region: { ...params.region },
      barMark,
      barDiameter: params.diameter,
      coverDistance,
      barSpacing: params.barSpacing,
      edgeDistanceStart: params.edgeDistanceStart,
      edgeDistanceEnd: params.edgeDistanceEnd,
      orientation: params.orientation,
      bars: bars.map((bar) => bar.id),
    };
    // Q8 clash report over the PROSPECTIVE model (existing bars + the new
    // ones) — computed before any dispatch so the check is pure and the
    // command stays non-blocking by construction (§K.4).
    const clashes = findBarClashes({
      bars: [...Object.values(state.project.reinforcement), ...bars],
      involvingIds: group.bars,
    });
    dispatch(addBars(bars));
    dispatch(addPlacementGroup(group));
    dispatch(setNextBarMark(barMark + 1));
    return { groupId, barIds: group.bars, clashes };
  };
