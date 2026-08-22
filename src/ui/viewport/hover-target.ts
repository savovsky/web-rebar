// Hover picking for the Select tool (§B.5): ONE transient hovered entity,
// resolved from the R3F intersection list by priority — smallest entity wins
// (bar > wall > section volume), distance decides within a type. A bar beats
// only the wall that HOSTS it (transparent concrete, §L.2): a bar hidden in a
// wall BEHIND the clicked wall must never win. Click handlers resolve the same
// pickPointerWinner, so the hover highlight always previews exactly what a
// click would select. Transient by design (§E, mirrors cursor-position.ts):
// hover changes at pointer rate must not spam the Redux action log.
//
// §B.5 revised 2026-08-22 (M3 T5): SHIFT+HOVER over a bar that belongs to a
// placement group pre-selects the ENTIRE group — the hover target becomes
// { entityType: 'barGroup', id: placementGroupId } and every member bar
// highlights (the group can then be deleted together; a group MOVE gesture
// does not exist — move the host, §E). The group id rides on the bar mesh's
// userData, so this React-free module needs no store access.
import { useEffect, useSyncExternalStore } from 'react';
import type { Intersection } from 'three';

export type HoverEntityType = 'bar' | 'barGroup' | 'section' | 'wall';

export interface HoverTarget {
  entityType: HoverEntityType;
  id: string;
  /** Bar targets only: the bar's placement-group id when it has one — the
   *  Shift+hover group pre-selection handle (§B.5, M3 T5). */
  placementGroupId?: string;
}

/** userData contract on interactive meshes (BarMesh, WallMesh, SectionVolume). */
interface EntityUserData {
  entityType?: string;
  entityId?: string;
  hostElementId?: string;
  placementGroupId?: string;
}

const readEntity = (hit: Intersection): (HoverTarget & { hostElementId?: string }) | null => {
  const data = hit.object.userData as EntityUserData;
  if (data.entityType !== 'bar' && data.entityType !== 'wall' && data.entityType !== 'section') return null;
  if (data.entityId === undefined) return null;
  return {
    entityType: data.entityType,
    id: data.entityId,
    hostElementId: data.hostElementId,
    placementGroupId: data.placementGroupId,
  };
};

/**
 * Ray hit list (sorted near→far by R3F) → the entity a Select-tool click acts
 * on. Priority by type, distance within a type; a bar outranks a wall only
 * when the wall hosts it (it shines through the wall's transparent concrete).
 */
export function pickPointerWinner(intersections: Intersection[]): HoverTarget | null {
  let closestBar: (HoverTarget & { hostElementId?: string }) | null = null;
  let closestWall: HoverTarget | null = null;
  let closestSection: HoverTarget | null = null;
  for (const hit of intersections) {
    const entity = readEntity(hit);
    if (!entity) continue;
    if (entity.entityType === 'bar' && closestBar === null) closestBar = entity;
    if (entity.entityType === 'wall' && closestWall === null) closestWall = entity;
    if (entity.entityType === 'section' && closestSection === null) closestSection = entity;
  }
  if (closestBar && (closestWall === null || closestBar.hostElementId === closestWall.id)) {
    return barTarget(closestBar);
  }
  if (closestWall) return closestWall;
  if (closestBar) return barTarget(closestBar); // bar over the void
  return closestSection;
}

/** Bar winner → hover target, keeping the placement-group handle when set. */
const barTarget = (bar: HoverTarget): HoverTarget =>
  bar.placementGroupId === undefined
    ? { entityType: 'bar', id: bar.id }
    : { entityType: 'bar', id: bar.id, placementGroupId: bar.placementGroupId };

let hovered: HoverTarget | null = null;
const listeners = new Set<() => void>();

export function getHoverTarget(): HoverTarget | null {
  return hovered;
}

export function setHoverTarget(next: HoverTarget | null): void {
  if (hovered === next) return;
  if (next !== null && hovered?.entityType === next.entityType && hovered.id === next.id) return;
  hovered = next;
  listeners.forEach((emit) => emit());
}

// --- Shift+hover group pre-selection (§B.5 revised 2026-08-22, M3 T5) ---

/** The raw pick and Shift state are remembered so pressing/releasing Shift
 *  re-resolves the hover WITHOUT a pointer move (hover a bar, hold Shift →
 *  its whole group highlights). */
let lastPick: HoverTarget | null = null;
let isShiftHeld = false;
let isHoverPinned = false;

/** Shift over a group member → the whole group is the hover target. A pinned
 *  hover (a Move drag is in flight) FREEZES at its pinned-time resolution:
 *  Shift mid-drag is the §B.3 snap toggle and must not flip a bar drag's
 *  hover into a group highlight; a GROUP drag (started under Shift) keeps
 *  its group highlight for the gesture. */
const resolveHoverFromPick = (): HoverTarget | null => {
  if (isHoverPinned) return hovered;
  if (isShiftHeld && lastPick?.entityType === 'bar' && lastPick.placementGroupId !== undefined) {
    return { entityType: 'barGroup', id: lastPick.placementGroupId };
  }
  return lastPick;
};

/** Pinned while a Move drag runs (element-drag.ts sets/clears it with the
 *  transient offset). Pinning freezes the CURRENT resolution for the gesture
 *  (a bar drag keeps the bar, a group drag keeps the group — "highlighted =
 *  what will move" stays true); unpinning re-resolves from the remembered
 *  pick + Shift state (the next pointer move refreshes anyway). */
export function setHoverPinned(pinned: boolean): void {
  if (isHoverPinned === pinned) return;
  isHoverPinned = pinned;
  setHoverTarget(pinned ? hovered : resolveHoverFromPick());
}

/** ALL pointer-move hover writes route here (Select + Move tools): stores the
 *  raw pick + Shift state, then publishes the resolved hover target. */
export function setHoverFromPick(winner: HoverTarget | null, shiftKey: boolean): void {
  lastPick = winner;
  isShiftHeld = shiftKey;
  setHoverTarget(resolveHoverFromPick());
}

/** Shift key state from the window-level tracker (useShiftKeyTracking);
 *  re-resolves the hover from the remembered pick. */
export function setShiftHeld(held: boolean): void {
  if (isShiftHeld === held) return;
  isShiftHeld = held;
  setHoverTarget(resolveHoverFromPick());
}

/** Window-level Shift tracking for the group pre-selection — mounted once in
 *  AppShell (the useToolShortcuts pattern). Node-env tests drive setShiftHeld
 *  directly. */
export function useShiftKeyTracking(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShiftHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') setShiftHeld(false);
    };
    const handleBlur = () => setShiftHeld(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
}

/** Clears the hover only when it still points at the given entity — safe
 *  against out/move ordering when the pointer crosses entity boundaries. A
 *  matching raw pick is forgotten too, so a later Shift press cannot resurrect
 *  a stale group highlight. */
export function clearHoverTarget(target: HoverTarget): void {
  if (lastPick?.entityType === target.entityType && lastPick.id === target.id) lastPick = null;
  if (hovered?.entityType === target.entityType && hovered.id === target.id) setHoverTarget(null);
}

export function subscribeHoverTarget(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Per-entity hover subscription — re-renders only when THIS entity's hover
 *  state flips (boolean snapshot, §E transient store). */
export function useIsHoverTarget(entityType: HoverEntityType, id: string): boolean {
  return useSyncExternalStore(
    subscribeHoverTarget,
    () => hovered?.entityType === entityType && hovered.id === id,
  );
}
