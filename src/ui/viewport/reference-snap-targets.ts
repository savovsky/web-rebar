// Shared hook (M2 T6): the §B.3 endpoint/midpoint snap targets of the VISIBLE
// reference documents, consumed by every placement-draft point resolution
// (GroundPlane for Place Wall, WallMesh for Place Bar). The record reference
// is stable across unrelated dispatches (Immer structural sharing), and
// per-document target extraction is identity-memoized in the engine
// (reference-snapping.ts) — this composition stays cheap even when a real
// import reaches ~67k primitives / ~200k targets.
import { useMemo } from 'react';
import { type ReferenceSnapTarget, collectReferenceSnapTargets } from '@/engine/reference-snapping';
import { useAppSelector } from '@/stores/hooks';

export function useReferenceSnapTargets(): ReferenceSnapTarget[] {
  const referenceDocuments = useAppSelector((state) => state.project.referenceDocuments);
  return useMemo(() => collectReferenceSnapTargets(Object.values(referenceDocuments)), [referenceDocuments]);
}
