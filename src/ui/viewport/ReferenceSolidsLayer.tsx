// IFC reference solids (M2 T6.5, plan Q7 — foreign products as render-only
// dummy solids): every VISIBLE solids document renders as ONE merged mesh
// (the T6 ReferenceLayer pattern — the author's 4,008-product steel export
// merges to ~128k triangles in a single draw call) with per-vertex IFC
// colors at reduced opacity (the --reference-solid token is the fallback for
// unstyled parts; the opacity constant lives in ./constants — rule 6).
// Reference, not model (M2 plan Q3 contract): the meshes carry NO pointer
// handlers and NO entity userData, so R3F never raycasts them and
// pickPointerWinner can never return one — solids are unselectable,
// unmovable, unsnappable, and feed no computation by construction.
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import type { SolidsReferenceDocument } from '@/data/models';
import {
  SOLID_COLOR_COMPONENTS,
  SOLID_NORMAL_COMPONENTS,
  SOLID_POSITION_COMPONENTS,
  buildReferenceSolidBuffers,
} from '@/engine/reference-geometry';
import { useAppSelector } from '@/stores/hooks';
import { REFERENCE_SOLID_OPACITY } from './constants';
import { useViewportTheme } from './viewport-theme';

function ReferenceDocumentSolids({
  document,
  fallbackColorCss,
}: {
  document: SolidsReferenceDocument;
  fallbackColorCss: string;
}) {
  // The document is a frozen model object — its identity changes exactly when
  // its content does (Immer structural sharing), so the memo key is sound.
  const geometry = useMemo(() => {
    const fallback = new Color(fallbackColorCss);
    const buffers = buildReferenceSolidBuffers({
      solids: document.solids,
      fallbackColor: { r: fallback.r, g: fallback.g, b: fallback.b },
      opacity: REFERENCE_SOLID_OPACITY,
    });
    const merged = new BufferGeometry();
    merged.setAttribute('position', new Float32BufferAttribute(buffers.positions, SOLID_POSITION_COMPONENTS));
    merged.setAttribute('normal', new Float32BufferAttribute(buffers.normals, SOLID_NORMAL_COMPONENTS));
    merged.setAttribute('color', new Float32BufferAttribute(buffers.colors, SOLID_COLOR_COMPONENTS));
    merged.setIndex(new Uint32BufferAttribute(buffers.indices, 1));
    return merged;
  }, [document, fallbackColorCss]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      {/* Vertex alpha carries the reduced opacity; depthWrite stays ON — the
          solids are real occluders (a ghost you can see the model through,
          but correct against itself and against what stands behind it). */}
      <meshStandardMaterial vertexColors transparent depthWrite />
    </mesh>
  );
}

export function ReferenceSolidsLayer() {
  const theme = useViewportTheme();
  const documents = useAppSelector((state) => state.project.referenceDocuments);
  return (
    <>
      {Object.values(documents).map((document) =>
        document.content === 'solids' && document.visible ? (
          <ReferenceDocumentSolids
            key={document.id}
            document={document}
            fallbackColorCss={theme.referenceSolid}
          />
        ) : null,
      )}
    </>
  );
}
