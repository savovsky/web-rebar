// Transient viewport cursor state (§E): the raw point mutates at pointer rate
// and is read from useFrame by draft previews; the rounded snapshot notifies
// React subscribers (status bar) only when the millimetre value changes.
// Deliberately NOT in Redux — 60 FPS pointer data must not spam the action log.
import type { Vec3 } from '@/data/models';

export interface CursorSnapshot {
  x: number;
  y: number;
}

let rawPoint: Vec3 | null = null;
let snapshot: CursorSnapshot | null = null;
const listeners = new Set<() => void>();

/** Unrounded effective (post-snap) point — read by useFrame, never by React state. */
export function getCursorRawPoint(): Vec3 | null {
  return rawPoint;
}

export function setCursorPoint(point: Vec3 | null): void {
  rawPoint = point;
  const next = point ? { x: Math.round(point.x), y: Math.round(point.y) } : null;
  if (next === null && snapshot === null) return;
  if (next !== null && snapshot !== null && next.x === snapshot.x && next.y === snapshot.y) return;
  snapshot = next;
  listeners.forEach((emit) => emit());
}

export function subscribeCursorPosition(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCursorSnapshot(): CursorSnapshot | null {
  return snapshot;
}

/** Status-bar readout (§B.2): plan coordinates in whole millimetres. */
export function formatCursorPosition(position: CursorSnapshot | null): string {
  if (!position) return 'X: — Y: —';
  return `X: ${position.x} Y: ${position.y}`;
}
