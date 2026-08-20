// M2 T5 — reference-document §N commands: importReferenceDocument (ONE reducer
// → exactly ONE undo level, the plan's F3 door-check note), removeReference-
// Document, setReferenceDocumentVisibility; undo/redo exact-reference restore;
// rejection paths that mutate nothing and record no undo level.
import { describe, expect, it } from 'vitest';
import {
  importReferenceDocument,
  redo,
  removeReferenceDocument,
  setReferenceDocumentVisibility,
  undo,
} from '@/commands';
import { createAppStore } from '@/stores';
import { expectCommandError } from './test-utils';

/** Small DXF text builder — HEADER ($INSUNITS optional) + the given ENTITIES body. */
const dxfText = (options: { insunits?: number; entities: string }): string =>
  [
    '  0',
    'SECTION',
    '  2',
    'HEADER',
    ...(options.insunits === undefined ? [] : ['  9', '$INSUNITS', ' 70', `     ${options.insunits}`]),
    '  0',
    'ENDSEC',
    '  0',
    'SECTION',
    '  2',
    'ENTITIES',
    options.entities,
    '  0',
    'ENDSEC',
    '  0',
    'EOF',
    '',
  ].join('\n');

const LINE_ENTITY = [
  '  0',
  'LINE',
  '  8',
  'WALLS',
  ' 10',
  '1.0',
  ' 20',
  '1.0',
  ' 11',
  '2.0',
  ' 21',
  '1.0',
].join('\n');
const TEXT_ENTITY = ['  0', 'TEXT', '  8', '0', ' 10', '0.0', ' 20', '0.0', ' 40', '2.5', '  1', 'hi'].join(
  '\n',
);

const CM_LINE_DXF = dxfText({ insunits: 5, entities: LINE_ENTITY });
const UNITLESS_LINE_DXF = dxfText({ entities: LINE_ENTITY });
const TEXT_ONLY_DXF = dxfText({ insunits: 4, entities: TEXT_ENTITY });

describe('importReferenceDocument (M2 plan T5, Q3/Q4)', () => {
  it('imports a DXF file as ONE reference document — exactly ONE undo level, exact undo/redo restore', async () => {
    const store = createAppStore();
    const before = store.getState().project;

    const summary = await store.dispatch(
      importReferenceDocument({ text: CM_LINE_DXF, fileName: 'plan.dxf' }),
    );

    const project = store.getState().project;
    const document = project.referenceDocuments[summary.documentId];
    expect(document).toBeDefined();
    expect(document.name).toBe('plan.dxf');
    expect(document.source).toEqual({ kind: 'dxf', fileName: 'plan.dxf', insunits: 5 });
    expect(document.elevationMm).toBe(0);
    expect(document.visible).toBe(true);
    // cm → mm (Q4): the (1,1)-(2,1) line lands at (10,10)-(20,10).
    expect(document.primitives).toEqual([
      { kind: 'line', start: { x: 10, y: 10 }, end: { x: 20, y: 10 }, sourceLayer: 'WALLS' },
    ]);
    expect(summary).toMatchObject({
      name: 'plan.dxf',
      primitiveCount: 1,
      appliedInsunits: 5,
      scaleToMm: 10,
      unitsAssumed: false,
    });

    // ONE reducer → exactly ONE undo level (the plan's F3 door-check note).
    expect(store.getState().undo.past).toHaveLength(1);
    store.dispatch(undo());
    expect(store.getState().project).toBe(before);
    store.dispatch(redo());
    expect(store.getState().project).toBe(project);
  });

  it('a unitless file imports as mm with the warning flag set (Q4)', async () => {
    const store = createAppStore();
    const summary = await store.dispatch(
      importReferenceDocument({ text: UNITLESS_LINE_DXF, fileName: 'plan.dxf' }),
    );
    expect(summary.unitsAssumed).toBe(true);
    expect(summary.scaleToMm).toBe(1);
    expect(summary.appliedInsunits).toBe(4);
    const document = store.getState().project.referenceDocuments[summary.documentId];
    expect(document.primitives[0]).toMatchObject({ start: { x: 1, y: 1 }, end: { x: 2, y: 1 } });
  });

  it('the units override wins over the declared $INSUNITS (Q4)', async () => {
    const store = createAppStore();
    const summary = await store.dispatch(
      importReferenceDocument({ text: CM_LINE_DXF, fileName: 'plan.dxf', insunitsOverride: 6 }),
    );
    expect(summary.appliedInsunits).toBe(6);
    expect(summary.scaleToMm).toBe(1000);
    expect(summary.unitsAssumed).toBe(false);
    const document = store.getState().project.referenceDocuments[summary.documentId];
    expect(document.source).toMatchObject({ insunits: 6 });
    expect(document.primitives[0]).toMatchObject({ end: { x: 2000, y: 1000 } });
  });

  it('an unknown override code is rejected without mutating anything', async () => {
    const store = createAppStore();
    await expect(
      store.dispatch(
        importReferenceDocument({ text: UNITLESS_LINE_DXF, fileName: 'plan.dxf', insunitsOverride: 42 }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
    expect(store.getState().project).toEqual(expect.objectContaining({ referenceDocuments: {} }));
    expect(store.getState().undo.past).toHaveLength(0);
  });

  it('rejects empty content and an empty file name without mutating or recording undo', async () => {
    const store = createAppStore();
    await expect(
      store.dispatch(importReferenceDocument({ text: '   \n ', fileName: 'plan.dxf' })),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
    await expect(
      store.dispatch(importReferenceDocument({ text: UNITLESS_LINE_DXF, fileName: '  ' })),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
    expect(store.getState().project).toEqual(expect.objectContaining({ referenceDocuments: {} }));
    expect(store.getState().undo.past).toHaveLength(0);
  });

  it('rejects non-DXF content (parser failure) without mutating or recording undo', async () => {
    const store = createAppStore();
    await expect(
      store.dispatch(importReferenceDocument({ text: 'definitely not dxf', fileName: 'notes.txt' })),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' });
    expect(store.getState().project).toEqual(expect.objectContaining({ referenceDocuments: {} }));
    expect(store.getState().undo.past).toHaveLength(0);
  });

  it('a file with no supported geometry imports as an EMPTY document — the skip report tells the story', async () => {
    const store = createAppStore();
    const summary = await store.dispatch(
      importReferenceDocument({ text: TEXT_ONLY_DXF, fileName: 'notes.dxf' }),
    );
    expect(summary.primitiveCount).toBe(0);
    expect(summary.skipped.unsupportedEntities.TEXT).toBe(1);
    expect(store.getState().project.referenceDocuments[summary.documentId].primitives).toEqual([]);
  });
});

describe('removeReferenceDocument', () => {
  it('removes the document in ONE undo level; undo restores the exact reference; NOT_FOUND for unknown ids', async () => {
    const store = createAppStore();
    const { documentId } = await store.dispatch(
      importReferenceDocument({ text: CM_LINE_DXF, fileName: 'plan.dxf' }),
    );
    const withDocument = store.getState().project;

    store.dispatch(removeReferenceDocument({ documentId }));
    expect(store.getState().project.referenceDocuments[documentId]).toBeUndefined();
    expect(store.getState().undo.past).toHaveLength(2); // import + remove

    store.dispatch(undo());
    expect(store.getState().project).toBe(withDocument);
    store.dispatch(redo());
    expect(store.getState().project.referenceDocuments[documentId]).toBeUndefined();

    expectCommandError(() => store.dispatch(removeReferenceDocument({ documentId: 'missing' })), 'NOT_FOUND');
  });
});

describe('setReferenceDocumentVisibility', () => {
  it('flips the document-level render flag (undoable like every project mutation); NOT_FOUND for unknown ids', async () => {
    const store = createAppStore();
    const { documentId } = await store.dispatch(
      importReferenceDocument({ text: CM_LINE_DXF, fileName: 'plan.dxf' }),
    );
    expect(store.getState().project.referenceDocuments[documentId].visible).toBe(true);

    store.dispatch(setReferenceDocumentVisibility({ documentId, visible: false }));
    expect(store.getState().project.referenceDocuments[documentId].visible).toBe(false);

    store.dispatch(undo());
    expect(store.getState().project.referenceDocuments[documentId].visible).toBe(true);
    store.dispatch(redo());
    expect(store.getState().project.referenceDocuments[documentId].visible).toBe(false);

    expectCommandError(
      () => store.dispatch(setReferenceDocumentVisibility({ documentId: 'missing', visible: false })),
      'NOT_FOUND',
    );
  });
});
