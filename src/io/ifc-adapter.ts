// IFC import/export via web-ifc — §C, §D.4.
// Export: IMPLEMENTED (M2 T2) — the pure ProjectModel → IFC4 mapping lives in
// src/io/ifc-mapping.ts, driven by the §N exportIfc command
// (src/commands/export-ifc.ts), which owns the lazy web-ifc load.
// Import: IMPLEMENTED (M2 T3) — the pure IFC4 → walls/bars mapping lives in
// src/io/ifc-import.ts (intent from the Q2 psets, ids from GlobalId, verbatim
// coordinates), driven by the §N importIfcModel command
// (src/commands/import-ifc.ts) → exactly one undo level per import.
// This file stays as the module-map signpost; both mapping modules statically
// import web-ifc and are reached from app code only via dynamic import (Q1).
