# Architecture & Code Review Report — Web Rebar POC
**Date:** 2026-08-22
**Reviewer:** Principal Architect / Domain Reviewer
**Context:** POC Phase (Post-M3 completion, approaching M4)

---

## 1. High-Level Impressions: "The Good and the Great"

Having deeply reviewed the project's source tree, documentation, and module architecture, I have to say: **this is an exceptionally well-engineered POC.** 

Too often, POCs are spaghetti-code prototypes thrown together to prove a UI concept, leaving a massive tech-debt crater. This project is the exact opposite. The foundational choices show clear foresight into what makes a heavy 3D CAD application scale on the web:

1. **The Documentation & ADR Parity:** The level of architectural discipline is staggering. Tying explicit spec sections (e.g., `§N`, `§F.2`) directly into source code comments (`src/commands/place-bar-group.ts`) ensures that institutional knowledge is never lost. The decision logs in `docs/` are world-class.
2. **Strict Command Pattern:** By forcing all mutations through Redux Thunks (`src/commands/`), you have effectively separated business logic from the UI. The UI components are correctly "dumb," only dispatching commands and rendering views. This means your undo/redo stack is structurally sound by design, not by accident.
3. **WASM-Driven Core (`core/src/`):** Shifting the heavy mathematical lifting (face-local rendering, `parry3d-f64` collision checks) to Rust/WASM is exactly the right call for "Figma for Concrete." It grants you low-level memory access and algorithmic safety while keeping the React loop focused on the view.
4. **Coordinate & Unit Sanity:** Forcing millimeter + Z-up right-handed coordinates universally bridges the gap between typical engineering (IFC/DXF) workflows and Three.js defaults cleanly. This alone saves weeks of matrix-rotation nightmare debugging later on.

---

## 2. Areas to Watch (Risks & Bottlenecks entering M4)

As we move from M3 (Real Bar Placement) into M4 (Multi-Element Building / 50k+ bars scale), the physics of the browser will start pushing back against the current architecture. Here are the main areas to watch:

### A. Main Thread Blocking (The WASM/JS Boundary)
Currently, operations like `generateBarGroupPaths` or `findBarClashes` run synchronously across the JS/WASM boundary. 
- **The Risk:** Once you test the boundaries of 10,000–50,000 bars (especially complex clash checks over the `parry3d` loop), a 100ms+ execution time will freeze the UI thread, killing the "joyful" Figma-like interaction.
- **Improvement Suggestion:** Prepare to move the `core` WASM execution into **Web Workers**. Using libraries like `comlink` can allow your UI to dispatch a command, show a loading/computing draft state, and resolve the final geometry asynchronously.

### B. Rendering Overhead (GPU Draw Calls)
I see the documentation acknowledges `InstancedMesh`. At the current rate mapped in `m3-performance.test.ts`, creating individual meshes inside `BarsLayer.tsx` yields 1 draw call per bar.
- **The Risk:** 50,000 bars = 50,000 draw calls, which will completely overwhelm WebGL/WebGPU in standard execution.
- **Improvement Suggestion:** For M4, implementing standard `THREE.InstancedMesh` (or `@react-three/drei`'s `<Instances>`) based on bar diameter and bending shape is absolutely mandatory. This will collapse your draw calls from 50,000 to ~10-20.

### C. The Redux Payload Wall
The command pattern serializes the entire placement/update into the Redux store.
- **The Risk:** In Redux, every state mutation creates a new shallow copy of the state tree. As `project.elements` and `project.placementGroups` reach massive sizes, the diffing/cloning process inside Immer/Redux Toolkit can induce GC (Garbage Collection) pauses.
- **Improvement Suggestion:** Actively monitor Redux performance. Ensure you rely heavily on memoized selectors (via `reselect`). If it becomes a limit, you might need to partition the Redux store (e.g., active floor vs. inactive floors) or only patch partial bounds.

---

## 3. Product & UX/UI Recommendations

Keeping in mind the main goal — **a web-based app for concrete detailing that makes work a joy, not a pain** — here are some conceptual recommendations for the upcoming UI/UX heavy phases:

1. **Non-Blocking Error Surfacing:** 
   Your `CommandError` system is fantastic. As the UI shape solidifies, ensure these errors never trigger modal dialogs. Use subtle, transient UI overlays (Toasts in the corner or red parameter highlights in the properties panel) for invalid states (like `cover must be > 0`). The user should feel guided, not scolded.
2. **Contextual Mini-Tools:** 
   In tools like AutoCAD/Allplan, users traverse huge property grids. Stick aggressively to the Figma model. When a user double-clicks a `PlacementGroup`, a floating, contextual mini-window near the mouse (or clearly focused in the right sidebar) should appear allowing them to tab rapidly through `Diameter -> Spacing -> Cover` without moving the mouse across the 4K screen.
3. **Multiplayer Evolution (The Horizon):**
   If this tool eventually grows into collaborative "multiplayer" detailing (like Google Docs), be aware that Redux action replays do not easily resolve conflicts. Your `Command` approach is great for Event Sourcing, but true real-time collaboration will require CRDTs (Conflict-free Replicated Data Types like `Yjs`). Keep your command interfaces clean so you can swap the Redux backend for a CRDT provider later if needed.

## 4. Deep-Dive Code Review (Layer-by-Layer)

During a deeper dive across the main code pathways (Redux, WASM Boundary, Orchestration, Data), the application architecture demonstrated extreme discipline:

### A. Core Rust/WASM Math (`core/src/placement_group.rs`)
- **Flat data over boundary:** The usage of flat `f64` 1D arrays over `wasm_bindgen` for inputs and outputs avoids large memory serialization bottlenecks to and from JS. 
- **Pure Arithmetic:** Rust is used exclusively for stateless pure functions (e.g., analytical derivation of spacing intervals using predefined `1e-9` floating-point tolerances). The lack of shared mutation inside `core/` keeps the system thread-safe and deterministic.

### B. TS Orchestration Layer (`src/engine/placement-group.ts`)
- **The Bridge:** This layer brilliantly translates between the rich domain models (e.g., `FaceFrame`) and the flat array inputs that Rust expects. 
- **Predictable Error Boundaries:** Validation logic (ensuring negative spacing / zero bar inputs are caught) lives entirely here. Unrecoverable states throw primitive exceptions, which then surface nicely out through the Redux command envelope without polluting WASM.

### C. Undo/Redo Middleware (`src/stores/undo-middleware.ts`)
- **A Masterclass in State Recording:** This RTK Listener pattern is outstanding. Wrapping arbitrary async Redux thunks with a `CommandScope` and waiting until the top-level Promise resolves guarantees that all chained reducer actions belong to a **single undo step**. 
- **Zero-Boilerplate History:** Developers rarely have to think about "How do I undo this feature?" You write standard actions, and the pipeline generically saves the Snapshot reference (leveraging Immer structural sharing for minimal memory load). It is perfectly executed.

### D. Data Constraints (`src/data/models/placement-groups.ts`)
- **Abstract Geometry (Intent over Result):** Binding `faceKey` tracking generically to localized enumerations (like `face:negLength`) rather than caching global X/Y/Z matrices prevents model geometry desynchronization when parent hosts (walls) move, rotate, or reshape. This perfectly fulfills `§C` (Intent, not Result).


---

## 5. Architectural Smells & Concrete Improvements for M4

As the POC shifts toward scale (the 50,000 bar building), several "code smells" and structural bottlenecks must be aggressively managed. Here are my specific findings and recommendations.

### Smell 1: The `maxWorkers: '25%'` Band-Aid in Vitest
- **Observation:** In the M3 log (T7), there's a note about test flakiness under load, pushing the timeout to 120s and capping `vitest` workers at 25%. Vitest oversubscribing the CPU means transformation parsing is duplicating, choking I/O.
- **Why it matters:** Passing tests by kneecapping the runner masks actual test suite inefficiencies. A 26-second test run for 483 unit tests is acceptable now, but as M4 scales, this will grow exponentially if not structurally fixed.
- **Recommendation:** Switch Vitest to run using `--isolation=false` or configure a single unified JS/DOM environment context for pure math/reducer tests. Separate the WebGL/Three.js heavy mounting tests from pure function (Redux/WASM) tests.

### Smell 2: Explicit Single-Threaded Redux (`undo-middleware.ts`)
- **Observation:** The `activeScope` variable in the undo-middleware assumes that the UI dispatch loop is strictly serial.
- **Why it matters:** As you introduce Web Workers (which you MUST for M4 computation), you will likely experience concurrent command dispatches (e.g., Worker A finishes laying out Wall 1, Worker B finishes Wall 2). The singleton `activeScope` will incorrectly bleed actions across scopes, corrupting the undo history. 
- **Recommendation:** Assign a deterministic `transaction_id` or `scope_id` to Redux thunks. When an asynchronous command starts, it generates a `scope_id`. Subsequent reducer dispatches from that thunk thread pass the `scope_id` inside the action payload, allowing the listener to bin actions into the correct undo step deterministically, independent of timing.

### Smell 3: High Chunk Size (`web-ifc-api.js` is 3.5MB)
- **Observation:** Running `pnpm build` reveals that `web-ifc-api` is parsing out at over ~3.5MB (minifying to 391KB gzipped) in a single chunk. The Vite reporter specifically warns about chunk size limits.
- **Why it matters:** This will throttle the Time-To-Interactive (TTI) on slower networks, violating the fast "Figma for concrete" mentality immediately upon app load.
- **Recommendation:** Configure Vite/Rolldown to aggressively split the `web-ifc` dependencies into asynchronous lazy chunks. The IFC parser should ONLY load when `importIfcModel` or `exportIfc` is initiated by the user, rather than riding in the primary vendor chunk upon application boot.

### Smell 4: `BarMesh.tsx` 1:1 Rendering Mapping
- **Observation:** Currently, rendering 50,000 bars will require 50,000 `<mesh>` instances in the `R3F` canvas.
- **Why it matters:** 50,000 distinct draw calls will reduce framerate to <10 FPS on mid-tier integrated graphics. CPU time will be overwhelmed iterating over the Three.js scene graph.
- **Recommendation (Mandatory for M4):** Implement `<InstancedMesh>` grouped by Bar Diameter and Bending Shape. You can maintain hover/picking capabilities using Instance IDs (gl_InstanceID maps back to your Redux `barId`). This reduces 50k draw calls down to ~15.

### Smell 5: Cascade Deletes / Ghost References
- **Observation (Open Item T8/2):** M3 explicitly notes that deleting a host (a wall) leaves orphan `PlacementGroup` data scattered in the Redux store ("Host-cascade for groups OPEN... deleteElement leaves orphan group records that can never regenerate").
- **Why it matters:** Over time (days of editing), these orphan records bloat the Redux tree, slowing down immutable cloning (`Immer`) and taking up memory for objects that can no longer render.
- **Recommendation:** Implement a central Garbage Collection middleware (or explicitly resolve the cascade on delete). If a `hostElementId` is removed from `project.elements`, sweep that ID against `project.placementGroups` immediately within the *same* undo scope. Do not allow ghost items to persist in the `ProjectModel`. 

---

## Conclusion

This is an **A+ grade starting point**. The fundamentals are incredibly solid. By focusing early on the performance bottlenecks (Instanced rendering & Web Workers) before hitting M4 scale, and maintaining the strict split between the Business Logic (Commands/WASM) and View (R3F/React), you are on track to build a truly disruptive BIM web tool. Keep going!