# Web Rebar POC - Architecture and Experience Review

**Date:** 2026-08-22  
**Reviewer:** GitHub Copilot  
**Review point:** M3 complete; M4 planning next  
**Scope:** Read-only review of the active `A_MVP_Scope_M3` branch, its M0-M3 implementation history, source modules, Rust/WASM core, command/store patterns, adapters, tests, UX surfaces, and project documentation. The existing `architecture-review-2026.md` was reviewed for comparison and was not changed.

## Executive Assessment

This is a strong POC with unusually good engineering discipline. The project has already validated the riskiest early assumptions: a browser-native geometry core, correct millimetre/Z-up interchange, editable internal intent rather than IFC-as-state, DXF tracing, IFC round-trip, rule-based group placement, and non-blocking clash detection.

The most valuable outcome is not the current wall-and-bar feature set. It is the set of reusable boundaries already in place:

- The project model stores engineering intent while meshes, section primitives, and viewport state remain derived.
- Named commands provide one mutation doorway for UI, tests, future scripting, and future MCP integration.
- The Rust core is stateless and uses compact flat-array boundaries.
- Undo is command-scoped and exact-reference restoration is tested.
- The documentation records decisions, rejected alternatives, performance measurements, manual scenarios, and explicit deferred topics.

The project is therefore ready to grow, but M4 should not be treated as only "add slabs, beams, columns, and a tree." It is the milestone where the app must establish four operational contracts:

1. A project can never enter an invalid or unbounded geometric state.
2. The visible detailing scope is the unit of rendering and computation.
3. Long-running work cannot corrupt undo history or freeze the interaction loop.
4. Native project persistence can round-trip every supported project feature, including reference solids.

My recommendation is to make those contracts explicit in M4 before broadening modification tools or polishing the viewport. That order protects the long-term goal: a fast, calm detailing workstation rather than a browser viewer with increasingly expensive commands.

## What Is Working Especially Well

### 1. The architecture matches the product

The project does not confuse BIM exchange, render geometry, and edit intent. `ProjectModel` owns editable domain records; `src/engine/` produces derived geometry and sections; `src/io/` translates external formats. That is the correct basis for a detailing tool where users must change cover, spacing, marks, and host relationships after import.

The local-face placement-group design is particularly sound. A group stores a host id, a stable parametric face key, and face-local region/rule parameters. This means translation and rotation do not require repairing world-space rule geometry. It is a durable model for later slabs, beams, and columns.

### 2. The command boundary is a real product asset

The `src/commands/` registry is not ceremonial architecture. It keeps UI handlers thin, concentrates validation and cascades, makes mutation effects auditable, and provides a natural future API for scripts and MCP tools. The registry-completeness and undo-probe tests make future command additions harder to get subtly wrong.

This should remain the application boundary. Do not allow future tree, properties, or viewport features to bypass commands just because their first implementation looks simpler through direct reducer dispatch.

### 3. The POC probes are evidence-based

The M2/M3 plans do more than list aspirations. They record real IFC/DXF compatibility checks, WASM size changes, Rust precision gates, 1,000-bar timing probes, and manual scenario outcomes. The M3 result that group regeneration stays below the 100 ms tripwire because reducers are batched is exactly the sort of measured conclusion that should guide M4.

The project also makes a healthy distinction between measured evidence and optimization. Per-bar meshes were intentionally measured, not prematurely replaced. That restraint is appropriate during a POC.

### 4. UX direction is concrete rather than generic

The interaction model is aligned with professional detailing: direct manipulation, explicit hover winner, group operations through bars, grid/reference snaps, short status feedback, and non-modal command errors. The background-tracing workflow is particularly important because it reflects how detailers actually begin their work rather than forcing an abstract blank-canvas workflow.

The existing design-token discipline is also a good foundation for later UI churn. It keeps compact CAD density, theming, and visual states from spreading literal styling values across the application.

### 5. Test shape is strong for the current phase

The command and engine suites cover important invariants: exact undo/redo, rule-exact regeneration, host follow, detach/refill semantics, IFC identity, DXF units, deterministic clash reports, and real Rust/WASM crossings. The latest recorded M3 gate was `483/483` Vitest tests, with Rust formatting, Clippy, and tests also green for Rust-touching work.

The scenario ledger is a useful future E2E backlog because it records user-observable behavior instead of framework implementation details.

## Findings Requiring M4 Decisions

The following are verified implementation risks, not arguments for abandoning the current design. They are ordered by urgency.

| Priority | Finding | Why It Matters | Recommendation |
| --- | --- | --- | --- |
| P0 | Group generation has no cardinality or progress limit. | A tiny positive spacing can request millions of bars. At floating-point extremes, adding spacing may stop changing the position and the Rust loop can fail to make progress. This can allocate excessive memory or block the UI thread before React can recover. | Define a command-level maximum bar count per group and a practical minimum spacing; calculate the predicted count before generating. Add a Rust-side iteration/progress guard as the final defensive boundary. Reject with `CommandError` and test tiny, sub-ULP, and maximum-count cases. |
| P0 | A moved or drawn group region is not required to remain inside its target face. | `movePlacementGroup` shifts face-local coordinates freely. Generated paths are later clamped by the all-face cover logic. An outside region can therefore turn several distinct rule positions into duplicate geometry at a wall edge, producing misleading rule state and self-clashes. | Make target-face containment a model invariant. Prefer command-side rejection for an out-of-face region during this POC; alternatively clamp and persist the clamped region so stored intent equals rendered result. Test region drags and moves past every face edge. |
| P0 | Several command entry points accept non-finite geometry. | `placeWall`, `placeBar`, and `extendBar` validate some shape constraints but do not reject `NaN` or infinity coordinates/scalars. Such values can enter Redux, break later WASM/rendering work, and cannot be represented faithfully in JSON persistence. Newer move commands already perform finite checks, so the validation contract is inconsistent. | Add shared finite-vector and finite-positive-scalar guards at every command ingress, including imported deltas. Keep command errors user-readable. Pin `NaN`, `Infinity`, and mixed-coordinate rejection in tests. |
| P0 before workers or more async work | Undo has one global active command scope. | `undo-middleware.ts` deliberately assumes serial command dispatch. While an import promise is pending, another command can join the same undo scope. Current File-menu transfers are serialized, but normal edits are not generally locked, and worker-based computation would make overlap more likely. | Choose one explicit model before adding workers: transaction ids propagated through commands and project actions, or a global command queue/interaction lock for mutation commands. Add a regression test that starts an async import, edits a wall before completion, then verifies two independent undo steps. |
| P1 | Collision broad phase is still pair enumeration. | AABB filtering avoids many narrow-phase distance calls, but the Rust engine still visits every bar pair. At 20,000 bars that is about 200 million candidate pairs; at 50,000 it is about 1.25 billion. This is incompatible with a model-wide synchronous check even when exact distance is fast. | Preserve the deterministic narrow phase but add a spatial broad phase, such as uniform cells or an R-tree/grid over expanded bar AABBs. Scope checks to the active detailing layer/storey. Move large checks off the interaction thread with cancellation and stale-result protection. |
| P1 | Rendering is one React component, geometry build, material, and draw call per bar. | This is measured and documented, not an accidental M3 omission. It will nevertheless block the stated 20,000-50,000 bar target due to React scene-graph overhead, mesh generation, GPU buffers, and draw calls. | Design the renderer by representation class before implementing it: instance straight bars, batch or merge repeated bent-shape families, and render far-away bars as lines. Do not interpret "one InstancedMesh per diameter" literally for arbitrary bent bars: `InstancedMesh` requires identical geometry, while chained bars can have different paths. Plan a picking-id mapping and selection/highlight overlay at the same time. |
| P1 | Persistence is specified but not implemented. | There is no native project save/load/new-project command or OPFS/IndexedDB implementation yet. This is increasingly material now that groups, marks, reference documents, and typed-array IFC solids exist. Typed arrays also deliberately bend the planned JSON-only persistence contract. | Treat persistence as an M4 foundation, not a finishing feature. Create a versioned serializer/migration boundary independent of Redux. Choose and test the typed-array strategy: binary OPFS sidecars are preferable to base64 inflation in `project.json`. Add native round-trip acceptance tests for groups, marks, references, and a foreign IFC solid. |
| P1 | Host deletion leaves orphan placement-group records. | This is an explicit M3 open item, not a newly discovered defect. The records cannot regenerate after their host is gone and may remain selected. | Decide one cascade rule in M4: delete host plus groups, or detach/conversion semantics if a meaningful product case exists. The default recommendation is a same-command cascade delete because a group is a host-face rule and has no independent geometry. |
| P2 | Placement-time clash feedback is inconsistent. | Group placement, group edits, group moves, and bar moves report prospective clashes. `placeBar` and `moveElement` do not, so the on-demand check is currently needed to discover clashes introduced through those workflows. | Extend proactive reports to every geometry-changing command or deliberately show a persistent "validation stale" affordance after unreported changes. The recommended path is uniform command results plus on-demand full recheck for confidence. |

## Product and UX Architecture for M4

### Make the layer/storey model a working-set model

The authoring workflow document contains the most important M4 UX requirement: detailers work on one element and nearby context, floor by floor. Visibility is therefore not merely a tree checkbox. It is the product's focus mechanism and its performance boundary.

The M4 model should define, together, all of these concerns:

- Building and storey hierarchy.
- Structural versus reinforcement discipline visibility.
- Active detailing scope for placement, collision checks, section calculation, and schedule queries.
- Hidden entities excluded from rendering, picking, expensive selectors, and candidate generation.
- Clear selection behavior when an entity becomes hidden.
- Reference-document groups using existing DXF source-layer tags and meaningful IFC groups without turning references into editable model entities.

The recommended first user experience is a compact Building panel with visibility controls, one explicit active scope, and a clear visual indication of what is currently editable. Do not start with a dense universal property tree. The first tree must reduce cognitive load during one real tracing-and-detailing flow.

### Preserve direct manipulation, but add confidence states

The direct-manipulation model is promising. As more rules and asynchronous work arrive, the user needs to know whether the model is current, computing, or warning-bearing without being interrupted by modal dialogs.

Recommended experience rules:

- Parameter edits should remain immediate where the result is small and deterministic.
- Work above the interaction budget should show a lightweight computing state and ignore or cancel stale results when the input changes.
- Warnings should say what changed and where to inspect it. A transient red highlight is useful, but it should not be the only remaining evidence after unrelated commands clear it.
- The active scope should make collision results intelligible: "12 clashes in Floor 3 - Wall W-12" is more useful than a global number.
- Properties should remain contextual. For repetitive detailing, keyboard progression through diameter, spacing, cover, and edge distances matters more than adding more panels.

### Design rendering and picking together

The present one-bar/one-mesh implementation makes hover and selection simple. An optimized renderer cannot lose that clarity.

Recommended rendering roadmap:

1. Keep the domain model and command API unchanged.
2. Introduce a renderer-owned render index from bar id to batch/instance/range.
3. Use instancing for straight bars, where one canonical cylinder can be positioned, oriented, and scaled per bar.
4. Use merged/chunked buffer geometry for bent or unique bars; use line representations at far zoom.
5. Use an id-buffer or batch-aware raycast proxy for picking instead of creating interactive R3F meshes for every bar.
6. Apply selection, hover, and clash colors through per-instance/per-vertex attributes or a small overlay layer.

This is more durable than a narrow "group by diameter" implementation because diameter alone does not make arbitrary swept bar geometry identical.

### Reference context is an opportunity, not just import support

M2 proved the useful minimum: DXF linework can guide tracing and foreign IFC can be visual context. The next quality step is reference hygiene:

- Per-source-layer/product-type visibility.
- Whole-document move, rotate, and scale alignment.
- A dedicated reference-edit mode for deletion/cleanup without accidental model selection.
- IFC units override for broken vendor files.

These features will make the product feel grounded in a real office workflow. They should stay clearly separate from promotion of foreign geometry into editable structural intent, which needs a later deliberate domain decision.

## Architecture Notes by Layer

### Domain model and commands

The normalized dictionaries, stable ids, group rule/back-reference pair, and project-level bar mark counter are good foundations. The next improvement is not more abstraction; it is a small set of explicit cross-record invariants:

- Every bar host must exist.
- Every grouped bar must appear in exactly one live group membership list.
- Every group host and target region must be valid.
- Marks must remain positive and the next mark must exceed all allocated marks after load/import.
- Reference document geometry must match the persistence strategy.

Put model validation at import/load boundaries and command validation at mutation boundaries. Do not put it in React selectors.

### Undo and asynchronous work

Snapshot undo is a good POC choice because it produces exact restores and works naturally with composite commands. Keep it unless measurements prove it inadequate.

The current risk is not snapshot size first; structural sharing has been measured and is helping. The first risk is transaction ownership when commands become asynchronous. A worker result should be treated as an input to a single command transaction, not as a background reducer stream. The command needs an input revision/token and must discard a result when the relevant model changed after the job began.

### Rust/WASM boundary

The stateless pure-function rule and flat arrays remain correct. Keep the core unaware of Redux, project ids, UI state, and undo.

For M4 scale, add defensive resource limits to the boundary functions. The TypeScript command layer should produce friendly parameter errors, while Rust still protects itself from malformed array data, non-progressing loops, impossible counts, and excessive allocations. Both layers are needed because future scripts or a worker can call the boundary differently from today's UI.

### Interoperability and persistence

The IFC/DXF architecture is strong: adapters are isolated, units are explicit, external interoperability was verified in real software, and heavy dependencies are dynamically loaded. The existing `web-ifc` chunk is lazy, so it is not a startup-shell regression; it still needs first-use progress/error UX and should remain outside the initial application graph.

Native persistence is now the missing counterpart. It should be an adapter too: `ProjectModel <-> persisted project bundle`, with migrations and integrity validation. Keeping it outside the slices will make OPFS, download/upload, autosave, and later cloud storage much easier to evolve.

### Documentation and repository process

The documentation is an unusual strength. The main maintenance risk is duplication: README session state, architecture revisions, implementation trackers, task logs, and scenario indexes can eventually disagree because several files repeat current status.

Recommendation: keep the architecture spec as the durable decision source and task trackers as execution evidence, but gradually reduce repeated status prose in the root README to a concise current-milestone pointer. A small generated or manually maintained release/status summary can later prevent drift without weakening the useful detail in task logs.

## Verification and Quality Strategy

The current unit and command-level coverage is excellent for a POC. The gap is browser-level confidence, which will grow as M4 introduces visibility, tree interaction, rendering batches, and asynchronous work.

Recommended test additions, in order:

1. Regression tests for the P0 input, face-region, generation-limit, and overlapping-undo cases above.
2. Native persistence round trips plus malformed/old-version migration fixtures.
3. A reference-scale M4 fixture that contains multiple storeys, visible/hidden scopes, groups, individual bent bars, and references.
4. A small Playwright suite driven by the durable scenario ids: application boot, tracing over DXF, active-scope visibility/picking, group edit, undo/redo, and a screenshot/canvas assertion for the viewport/section split.
5. Performance probes that measure visible working-set size separately from total project size.

The existing worker cap and explicit long-test timeouts are operationally reasonable at this point. They should be revisited after M4 changes the performance profile, but they are not evidence that the current suite is architecturally unsound.

Some manual scenarios remain intentionally pending or closed without a final rerun. That is acceptable for a POC close-out, but M4 should re-establish one compact end-to-end smoke path before adding many more UI surfaces.

## Review of the Existing Gemini Report

The existing report correctly identified several important themes:

- Per-bar mesh rendering cannot support the target scale.
- Main-thread heavy geometry/collision work needs a worker strategy at scale.
- The singleton undo scope is unsafe for overlapping asynchronous commands.
- Host deletion/group lifecycle needs a decision.

Two corrections are important:

- `web-ifc` is already dynamically loaded by the IFC commands and is not in the startup shell. Its lazy chunk size and first-use experience remain worth monitoring, but this is not an initial-load architectural failure.
- The M3 Vitest worker cap is an evidence-backed operational choice made after contention measurements. It should be monitored, not characterized as a fundamental test-suite smell without new evidence.

The rendering recommendation also needs one domain refinement: instancing by diameter alone works for straight bars, not arbitrary chained/bent swept geometry. The M4 rendering design should classify geometry representations and include picking/highlighting from the start.

## Recommended M4 Planning Order

1. **Safety and model integrity:** finite command inputs, group cardinality limits, region containment, host/group cascade rule, and persistence invariants.
2. **Layer/storey decision:** hierarchy, active scope, visibility, picking/compute semantics, reference grouping, and a representative real detailing workflow.
3. **Persistence vertical slice:** versioned project bundle, OPFS save/load/autosave, typed-array sidecar strategy, and migration/round-trip tests.
4. **Multi-element parametric core:** slabs, beams, columns, shared face-frame abstraction, host reshape semantics, and section composition.
5. **Scale architecture:** command transaction policy, worker protocol, scoped collision broad phase, render batching/LOD/picking, and measured budgets.
6. **UX validation:** a browser smoke suite and author walkthrough over a DXF/IFC-backed multi-storey model.

This sequence keeps M4 focused on the product's real promise: a detailer can work quickly and confidently in a small visible context while the system remains correct, recoverable, and ready for a larger project behind that context.

## Final Recommendation

Continue. The POC has crossed the important technical-risk threshold: its core boundaries are credible and its first domain workflows are real. The next success criterion should not be feature count. It should be one convincing multi-storey workflow where a detailer imports context, focuses a floor, models/edits several element types, places and adjusts reinforcement, sees trustworthy sections and warnings, saves/reopens the project, and remains responsive on ordinary hardware.

If M4 achieves that, the project will have demonstrated the essential product thesis: concrete reinforcement detailing can be precise without feeling heavy.
