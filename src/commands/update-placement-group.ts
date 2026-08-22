// §N command: edit a placement group's RULE → regenerate (§F.2, M3 plan
// section 3). The partial patch is merged command-side (T1's reducer takes
// the full replacement rule — no spooky partial-patch semantics), the merged
// rule is validated exactly like placement, and the group's bars are
// re-generated rule-exactly by the T2 orchestration: old bars removed + new
// bars added in the same command scope → ONE undo level restores the pre-edit
// group AND its previous bars exactly (milestone acceptance sentence 2, the
// M1 exact-reference pattern). The group keeps its id AND its barMark across
// regenerate — no new mark is consumed (Q7-a: the mark is the group's
// identity, not the bars' generation).
import { DEFAULT_STEEL_CATALOG } from '@/data/catalog/steel';
import type { FaceRegion, PlacementGroup, ReinforcementBar } from '@/data/models';
import { type BarClash, findBarClashes } from '@/engine/collision';
import type { AppThunk } from '@/stores';
import {
  addBars,
  removeBars,
  updatePlacementGroup as updatePlacementGroupReducer,
} from '@/stores/project-slice';
import { CommandError } from './command-error';
import { generateRulePaths, validateGroupRule } from './place-bar-group';

/** Partial rule edit — field names mirror the stored PlacementGroup rule.
 *  hostElementId/faceKey/barMark are NOT patchable: the target face is the
 *  group's identity (Q3-a) and the mark is its position number (Q7-a). */
export interface PlacementGroupPatch {
  region?: FaceRegion;
  barDiameter?: number;
  coverDistance?: number;
  barSpacing?: number;
  edgeDistanceStart?: number;
  edgeDistanceEnd?: number;
  orientation?: 'horizontal' | 'vertical';
}

export interface UpdatePlacementGroupParams {
  groupId: string;
  patch: PlacementGroupPatch;
}

export interface UpdatePlacementGroupResult {
  groupId: string;
  /** The NEW generated bar ids in layout order (the old set is gone). */
  barIds: string[];
  /** Exact clash report (Q8, §K.4 — non-blocking): pairs involving the
   *  regenerated bars, sorted by id; empty when nothing clashes. */
  clashes: BarClash[];
}

/** Command-side partial-patch merge (T1: the reducer replaces wholesale) —
 *  only defined patch fields override the stored rule. */
function mergePatch(group: PlacementGroup, patch: PlacementGroupPatch): PlacementGroup {
  return {
    ...group,
    region: patch.region ?? group.region,
    barDiameter: patch.barDiameter ?? group.barDiameter,
    coverDistance: patch.coverDistance ?? group.coverDistance,
    barSpacing: patch.barSpacing ?? group.barSpacing,
    edgeDistanceStart: patch.edgeDistanceStart ?? group.edgeDistanceStart,
    edgeDistanceEnd: patch.edgeDistanceEnd ?? group.edgeDistanceEnd,
    orientation: patch.orientation ?? group.orientation,
  };
}

/**
 * Re-generates the group's bars to the NEW rule exactly. The regenerated bars
 * keep the group's steel grade (carried over from the existing bars — the
 * §F.2 rule stores no grade; the placement default applies when no bar
 * survives to carry it).
 */
export const updatePlacementGroup =
  (params: UpdatePlacementGroupParams): AppThunk<UpdatePlacementGroupResult> =>
  (dispatch, getState) => {
    const state = getState();
    const group = state.project.placementGroups[params.groupId];
    if (!group) {
      throw new CommandError('NOT_FOUND', `updatePlacementGroup: group not found: ${params.groupId}`);
    }
    const host = state.project.elements[group.hostElementId];
    if (!host) {
      // The deleteElement cascade removes hosted bars but keeps dependent
      // records (the sections precedent — recorded in the T3 task log); a
      // group whose host is gone can never regenerate → guarded failure.
      throw new CommandError(
        'NOT_FOUND',
        `updatePlacementGroup: host element not found: ${group.hostElementId}`,
      );
    }

    const rule = mergePatch(group, params.patch);
    validateGroupRule({
      diameter: rule.barDiameter,
      coverDistance: rule.coverDistance,
      orientation: rule.orientation,
    });
    const paths = generateRulePaths({
      commandName: 'updatePlacementGroup',
      host,
      faceKey: rule.faceKey,
      region: rule.region,
      coverMm: rule.coverDistance,
      diameterMm: rule.barDiameter,
      spacingMm: rule.barSpacing,
      edgeDistanceStartMm: rule.edgeDistanceStart,
      edgeDistanceEndMm: rule.edgeDistanceEnd,
      orientation: rule.orientation,
    });
    if (paths.length === 0) {
      throw new CommandError('INVALID_PARAMS', 'updatePlacementGroup: the rule produced no bars');
    }

    const steelGrade =
      state.project.reinforcement[group.bars[0]]?.steelGrade ?? DEFAULT_STEEL_CATALOG.defaultGrade;
    const bars: ReinforcementBar[] = paths.map((path) => ({
      id: crypto.randomUUID(),
      hostElementId: group.hostElementId,
      diameter: rule.barDiameter,
      path,
      coverDistance: rule.coverDistance,
      steelGrade,
      barMark: group.barMark,
      placementGroupId: group.id,
    }));
    const barIds = bars.map((bar) => bar.id);
    // Q8 clash report over the PROSPECTIVE model (the group's old bars
    // replaced by the regenerated ones) — computed before any dispatch so
    // the regenerate stays non-blocking by construction (§K.4).
    const replacedIds = new Set(group.bars);
    const surviving = Object.values(state.project.reinforcement).filter((bar) => !replacedIds.has(bar.id));
    const clashes = findBarClashes({ bars: [...surviving, ...bars], involvingIds: barIds });
    dispatch(removeBars({ ids: group.bars }));
    dispatch(addBars(bars));
    dispatch(updatePlacementGroupReducer({ ...rule, bars: barIds }));
    return { groupId: group.id, barIds, clashes };
  };
