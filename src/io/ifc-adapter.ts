// IFC import/export via web-ifc — §C, §D.4.
// Export: IMPLEMENTED (M2 T2) — the pure ProjectModel → IFC4 mapping lives in
// src/io/ifc-mapping.ts and is driven by the §N exportIfc command
// (src/commands/export-ifc.ts), which owns the lazy web-ifc load.
// Import: arrives with M2 T3 (round-trip identical-model probe).

export function importIfc(_buffer: ArrayBuffer): unknown {
  throw new Error('Not implemented — see M2 T3');
}
