import { selectSectionPrimitives } from '@/engine/sectioning';
import type { AppThunk } from '@/stores';
import { CommandError } from './command-error';

export interface ExportSectionDxfParams {
  /** The section to export — the File menu passes the ACTIVE section (T7). */
  sectionId: string;
}

export interface ExportSectionDxfResult {
  /** Complete DXF file content (R2000/AC1015, true 1:1 mm model space — Q5). */
  text: string;
  /** Suggested download file name (`<project name>-<section name>.dxf`, sanitized). */
  fileName: string;
}

const DXF_FILE_EXTENSION = '.dxf';
const FALLBACK_FILE_STEM = 'untitled-section';
/** Filesystem-unsafe characters (the Windows set — the safest common denominator). */
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;

function sanitizeFileName(projectName: string, sectionName: string): string {
  const stem = `${projectName}-${sectionName}`.replace(UNSAFE_FILE_NAME_CHARS, '-').trim();
  return `${stem === '' ? FALLBACK_FILE_STEM : stem}${DXF_FILE_EXTENSION}`;
}

/**
 * §N command: export a section view to DXF (M2 plan T7 — Q5 true 1:1 mm
 * model-space export of the §G.1 primitives: closed LWPOLYLINE concrete
 * outlines, true-diameter CIRCLE cut-bar dots, DASHED background lines on the
 * three named layers). PURE: reads the project, mutates nothing, records no
 * undo level (the exportIfc/setActiveSection precedent — export is interop
 * output, not an edit, §E). The writer lives in the dxf-adapter module, which
 * imports dxf-parser statically — so it is DYNAMICALLY imported here (the
 * importReferenceDocument precedent): the whole DXF stack stays in the one
 * lazy chunk and never enters the shell bundle (the Q1/T6 bundle contract).
 * Requires the WASM module to be initialized (the §G.1 selector's cut-bar
 * plane intersections cross the §D boundary — app startup does this).
 */
export const exportSectionDxf =
  (params: ExportSectionDxfParams): AppThunk<Promise<ExportSectionDxfResult>> =>
  async (_dispatch, getState) => {
    const project = getState().project;
    const section = project.sections[params.sectionId];
    if (!section) {
      throw new CommandError('NOT_FOUND', `exportSectionDxf: section not found: ${params.sectionId}`);
    }
    const primitives = selectSectionPrimitives(getState(), params.sectionId);
    if (primitives === null) {
      // Unreachable while the section-existence guard above holds — the
      // selector returns null only for a missing section.
      throw new Error('exportSectionDxf: selector returned null for an existing section');
    }
    const { exportDxfSection } = await import('@/io/dxf-adapter');
    return {
      text: exportDxfSection(primitives),
      fileName: sanitizeFileName(project.metadata.name, section.name),
    };
  };
