import { loadIfcApi } from '@/io/web-ifc-loader';
import type { AppThunk } from '@/stores';

export interface ExportIfcResult {
  /** IFC-SPF file content (IFC4, mm — §C adapter output). */
  bytes: Uint8Array;
  /** Suggested download file name (`<project name>.ifc`, sanitized). */
  fileName: string;
}

const IFC_FILE_EXTENSION = '.ifc';
const FALLBACK_FILE_STEM = 'untitled';
/** Filesystem-unsafe characters (the Windows set — the safest common denominator). */
const UNSAFE_FILE_NAME_CHARS = /[\\/:*?"<>|]/g;

function sanitizeFileName(projectName: string): string {
  const stem = projectName.replace(UNSAFE_FILE_NAME_CHARS, '-').trim();
  return `${stem === '' ? FALLBACK_FILE_STEM : stem}${IFC_FILE_EXTENSION}`;
}

/**
 * §N command: export the whole project model to IFC4-SPF (M2 plan T2 — §C
 * adapter, Q2 design-intent psets, GlobalId = compressed UUID). PURE: reads
 * the project, mutates nothing, records no undo level (the setActiveSection
 * precedent — export is interop output, not an edit, §E). web-ifc is
 * lazy-loaded on first use (§D.4 revised 2026-08-18) — and so is the mapping
 * module itself (dynamic import): it imports web-ifc's 3.5 MB API statically,
 * so a static import here would pull the whole IFC stack into the shell
 * bundle. Tests import src/io/ifc-mapping.ts directly (bundling is irrelevant
 * there) and inject their own API instance.
 */
export const exportIfc = (): AppThunk<Promise<ExportIfcResult>> => async (_dispatch, getState) => {
  const project = getState().project;
  const [api, { buildIfcModel }] = await Promise.all([loadIfcApi(), import('@/io/ifc-mapping')]);
  const { modelID, bytes } = buildIfcModel(api, project);
  api.CloseModel(modelID);
  return { bytes, fileName: sanitizeFileName(project.metadata.name) };
};
