// Reference backgrounds (M2 T6 — the doc-11 tracing workflow): every VISIBLE
// reference document renders as ONE merged LineSegments (the T5 real-file
// probe reached ~67k primitives per import — per-primitive meshes are out of
// the question) at the document's elevationMm, in the muted --reference-line
// token (doc 10, rule 6). Backgrounds are reference, not model (M2 plan Q3):
// the meshes carry NO pointer handlers and NO entity userData, so R3F never
// raycasts them and pickPointerWinner can never return one — backgrounds are
// unselectable/unmovable by construction.
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { LineworkReferenceDocument } from '@/data/models';
import { LINE_POSITION_COMPONENTS, buildReferenceLinePositions } from '@/engine/reference-geometry';
import { useAppSelector } from '@/stores/hooks';
import { useViewportTheme } from './viewport-theme';

function ReferenceDocumentLines({ document, color }: { document: LineworkReferenceDocument; color: string }) {
  // The document is a frozen model object — its identity changes exactly when
  // its content does (Immer structural sharing), so the memo key is sound.
  const geometry = useMemo(() => {
    const merged = new BufferGeometry();
    merged.setAttribute(
      'position',
      new Float32BufferAttribute(buildReferenceLinePositions(document.primitives), LINE_POSITION_COMPONENTS),
    );
    return merged;
  }, [document]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} position={[0, 0, document.elevationMm]}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

export function ReferenceLayer() {
  const theme = useViewportTheme();
  const documents = useAppSelector((state) => state.project.referenceDocuments);
  return (
    <>
      {Object.values(documents).map((document) =>
        document.content === 'linework' && document.visible ? (
          <ReferenceDocumentLines key={document.id} document={document} color={theme.referenceLine} />
        ) : null,
      )}
    </>
  );
}
