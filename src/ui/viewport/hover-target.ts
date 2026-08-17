// Hover picking for the Select tool (§B.5): ONE transient hovered entity,
// resolved from the R3F intersection list by priority — smallest entity wins
// (bar > wall > section volume), distance decides within a type. A bar beats
// only the wall that HOSTS it (transparent concrete, §L.2): a bar hidden in a
// wall BEHIND the clicked wall must never win. Click handlers resolve the same
// pickPointerWinner, so the hover highlight always previews exactly what a
// click would select. Transient by design (§E, mirrors cursor-position.ts):
// hover changes at pointer rate must not spam the Redux action log.
import { useSyncExternalStore } from 'react';
import type { Intersection } from 'three';

export type HoverEntityType = 'bar' | 'section' | 'wall';

export interface HoverTarget {
  entityType: HoverEntityType;
  id: string;
}

/** userData contract on interactive meshes (BarMesh, WallMesh, SectionVolume). */
interface EntityUserData {
  entityType?: string;
  entityId?: string;
  hostElementId?: string;
}

const readEntity = (hit: Intersection): (HoverTarget & { hostElementId?: string }) | null => {
  const data = hit.object.userData as EntityUserData;
  if (data.entityType !== 'bar' && data.entityType !== 'wall' && data.entityType !== 'section') return null;
  if (data.entityId === undefined) return null;
  return { entityType: data.entityType, id: data.entityId, hostElementId: data.hostElementId };
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
    return { entityType: closestBar.entityType, id: closestBar.id };
  }
  if (closestWall) return closestWall;
  if (closestBar) return { entityType: closestBar.entityType, id: closestBar.id }; // bar over the void
  return closestSection;
}

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

/** Clears the hover only when it still points at the given entity — safe
 *  against out/move ordering when the pointer crosses entity boundaries. */
export function clearHoverTarget(target: HoverTarget): void {
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
