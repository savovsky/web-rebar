import type { ReferenceDocument } from '@/data/models';
import type { IfcImportResult } from '@/io/ifc-import';
import { loadIfcApi } from '@/io/web-ifc-loader';
import type { AppThunk } from '@/stores';
import type { ProjectState } from '@/stores/project-slice';
import { addBar, addElement, addReferenceDocument } from '@/stores/project-slice';
import { CommandError } from './command-error';

export interface ImportIfcModelParams {
  /** IFC-SPF file content (what exportIfc writes: IFC4, mm, Q2 intent psets). */
  buffer: Uint8Array;
  /** Original file name — the reference document's display name + provenance
   *  tag when the import yields reference solids (T6.5/Q7). Optional: the
   *  headless probes need no display name. */
  fileName?: string;
}

/** The Q7 reference outcome of an import — null when nothing became a solid
 *  (e.g. our own export: every geometry-carrying product carries intent). */
export interface ImportIfcReferenceSummary {
  documentId: string;
  /** Distinct foreign products that became solids. */
  products: number;
  /** Triangulated parts (≥ products — one per styled material per product). */
  parts: number;
  triangles: number;
  /** True when the file declared no usable length unit (raw assumed mm). */
  lengthUnitAssumed: boolean;
}

export interface ImportIfcModelSummary {
  importedWalls: number;
  importedBars: number;
  skipped: IfcImportResult['skipped'];
  reference: ImportIfcReferenceSummary | null;
}

/**
 * Structural validation of the parsed delta BEFORE the first dispatch — a
 * failed import mutates nothing and records no undo level. Catalog membership
 * (Ø/grade) is deliberately NOT validated: the catalog is project settings
 * (Multi-Country Catalogs is a deferred topic) and intent round-trips
 * verbatim (§C). Host references must resolve to a wall in the file or
 * already in the project (import merges; ids are stable UUIDs).
 */
function validateImportDelta(project: ProjectState, parsed: IfcImportResult): void {
  const seenIds = new Set<string>();
  for (const wall of parsed.walls) {
    if (wall.startPoint.x === wall.endPoint.x && wall.startPoint.y === wall.endPoint.y) {
      throw new CommandError('INVALID_PARAMS', `importIfcModel: zero-length wall axis (${wall.id})`);
    }
    if (wall.thickness <= 0 || wall.height <= 0) {
      throw new CommandError(
        'INVALID_PARAMS',
        `importIfcModel: wall ${wall.id} has non-positive thickness/height`,
      );
    }
    if (project.elements[wall.id] || seenIds.has(wall.id)) {
      throw new CommandError('INVALID_PARAMS', `importIfcModel: duplicate wall id ${wall.id}`);
    }
    seenIds.add(wall.id);
  }
  const hostIds = new Set([...Object.keys(project.elements), ...parsed.walls.map((wall) => wall.id)]);
  for (const bar of parsed.bars) {
    if (project.reinforcement[bar.id] || seenIds.has(bar.id)) {
      throw new CommandError('INVALID_PARAMS', `importIfcModel: duplicate bar id ${bar.id}`);
    }
    seenIds.add(bar.id);
    if (!hostIds.has(bar.hostElementId)) {
      throw new CommandError(
        'NOT_FOUND',
        `importIfcModel: bar ${bar.id} host not in the file or the project: ${bar.hostElementId}`,
      );
    }
    if (bar.path.length < 2 || bar.diameter <= 0) {
      throw new CommandError(
        'INVALID_PARAMS',
        `importIfcModel: bar ${bar.id} has a degenerate path/diameter`,
      );
    }
  }
}

/**
 * §N command: import an IFC file into the project model (M2 plan T3, extended
 * T6.5/Q7). Parses via web-ifc (lazy-loaded like exportIfc — the mapping
 * module is dynamically imported for the same Q1 bundle contract), then
 * dispatches ONE add reducer per entity PLUS at most ONE addReferenceDocument
 * reducer, all inside the command's undo scope → exactly ONE undo level per
 * import (Q4-a; the async-aware undo scope middleware keeps the scope open
 * across the awaits — see undo-middleware.ts). Entities with the Q2 intent
 * psets become editable walls/bars; geometry-carrying products WITHOUT them
 * (foreign files — an Advance Steel model) become ONE render-only reference
 * document of triangulated dummy solids (Q7 — never editable/picked/
 * sectioned/computed; pset-less walls/bars fold into the solids, the T6.5
 * in-task decision). Importing an entity id that already exists in the
 * project is an error — ids are stable round-trip UUIDs, so a collision
 * means a double import, never a merge (M4 may revisit with id remapping for
 * foreign files).
 */
export const importIfcModel =
  (params: ImportIfcModelParams): AppThunk<Promise<ImportIfcModelSummary>> =>
  async (dispatch, getState) => {
    const [api, { parseIfcModel }] = await Promise.all([loadIfcApi(), import('@/io/ifc-import')]);
    let parsed: IfcImportResult;
    try {
      parsed = parseIfcModel(api, params.buffer);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new CommandError('INVALID_PARAMS', `importIfcModel: failed to parse IFC — ${detail}`);
    }
    validateImportDelta(getState().project, parsed);
    for (const wall of parsed.walls) dispatch(addElement(wall));
    for (const bar of parsed.bars) dispatch(addBar(bar));
    let reference: ImportIfcReferenceSummary | null = null;
    if (parsed.referenceSolids.parts.length > 0) {
      const name = params.fileName ?? 'IFC import';
      const document: ReferenceDocument = {
        id: crypto.randomUUID(),
        name,
        source: { kind: 'ifc', fileName: name },
        visible: true,
        content: 'solids',
        solids: parsed.referenceSolids.parts,
      };
      // ONE reducer for the whole document (the plan's F3 door-check note —
      // no per-part cascade), inside the same command scope → the import
      // stays exactly ONE undo level.
      dispatch(addReferenceDocument(document));
      reference = {
        documentId: document.id,
        products: parsed.referenceSolids.products,
        parts: parsed.referenceSolids.parts.length,
        triangles: parsed.referenceSolids.triangles,
        lengthUnitAssumed: parsed.referenceSolids.lengthUnitAssumed,
      };
    }
    return {
      importedWalls: parsed.walls.length,
      importedBars: parsed.bars.length,
      skipped: parsed.skipped,
      reference,
    };
  };
