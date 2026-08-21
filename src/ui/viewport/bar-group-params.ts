// Place Bar Group rule params (M3 T4, plan §4): cover / Ø / spacing / edge
// distances / orientation with catalog defaults (§B.4), editable in the
// Properties panel BEFORE commit. Transient module store (the §E pattern,
// mirrors hover-target.ts): the panel writes at interaction rate, the live
// preview reads every frame, the commit path reads once — none of this is
// project state, so it stays out of Redux and out of undo history.
// In-task decision (recorded in the T4 log): params persist across
// placements for the app session (Figma-style — set Ø/spacing once, place
// many faces); the defaults re-apply only on a fresh app load.
import { useSyncExternalStore } from 'react';
import { DEFAULT_BAR_DIAMETER_MM, resolveDefaultCover } from '@/commands/place-bar';
import type { ElementKind } from '@/data/models';

export interface BarGroupRuleParams {
  coverMm: number;
  diameterMm: number;
  /** Center-to-center spacing (mm) along the spacing axis. */
  spacingMm: number;
  edgeDistanceStartMm: number;
  edgeDistanceEndMm: number;
  /** 'horizontal' = bars run along the face u axis (spaced along v);
   *  'vertical' = run along v (spaced along u). */
  orientation: 'horizontal' | 'vertical';
}

/** Typical wall detailing spacing (mm) — the catalog carries no spacing
 *  default; recorded as an in-task decision (T4). */
export const DEFAULT_GROUP_SPACING_MM = 150;

/** Catalog defaults (§B.4): Ø from the Place Bar default, cover from the
 *  catalog per host kind; edge distances default to the cover (the common
 *  "region minus cover" detailing case); vertical bars for a wall face. */
export function defaultBarGroupParams(hostKind: ElementKind): BarGroupRuleParams {
  const coverMm = resolveDefaultCover(hostKind);
  return {
    coverMm,
    diameterMm: DEFAULT_BAR_DIAMETER_MM,
    spacingMm: DEFAULT_GROUP_SPACING_MM,
    edgeDistanceStartMm: coverMm,
    edgeDistanceEndMm: coverMm,
    orientation: 'vertical',
  };
}

// M3 hosts are walls only (plan scope line) — the 'wall' defaults stand.
let params = defaultBarGroupParams('wall');
const listeners = new Set<() => void>();

export function getBarGroupParams(): BarGroupRuleParams {
  return params;
}

export function setBarGroupParams(patch: Partial<BarGroupRuleParams>): void {
  params = { ...params, ...patch };
  listeners.forEach((emit) => emit());
}

export function subscribeBarGroupParams(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Panel subscription — re-renders on every param change. */
export function useBarGroupParams(): BarGroupRuleParams {
  return useSyncExternalStore(subscribeBarGroupParams, getBarGroupParams);
}
