# ⚠️ TEMP session prompt — M3 T1 (PlacementGroup data model + project-slice reducers)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the M3 tracker. Created 2026-08-18 after the **M3 plan ✅ APPROVED** (Q1–Q8 exactly as recommended — see the tracker header).

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete, M3 plan ✅ approved) and the Rules for Implementation
Sessions. Then read docs/implementation-plans-and-tasks/m3-real-bar-placement.md
— the approved plan; the Q1–Q8 decisions and the door check are binding (deviations
must be raised explicitly and recorded in the tracker). Also read
docs/08-architecture-spec.md §F (placement), §E (host-follow/undo), §D (WASM
boundary), §B.5–§B.6 (selection + tool palette), §H.1 (project model).

Branch: `A_MVP_Scope_M3` (exists, pushed; the plan-approval commit is its head).
Implement **T1 only** — the data model + reducer task (rule 4: data model first).

## T1 scope (plan section 1)

1. **`src/data/models/placement-groups.ts`** — `PlacementGroup` per §F.2 as
   revised by the approved decisions:
   - **Q3 (host-local identity):** `hostElementId` + a stable local **face key**
     enum of the parametric prism's faces (e.g. `'face:negThickness' |
     'face:posThickness' | 'face:top' | …` for walls — the exact key set is
     decided in-task and recorded in the task log; never a world-space plane
     or a mesh id) + the region as **face-local (u,v) offsets**
     (`uMin/uMax/vMin/vMax`). The §F.2 `targetFaceId` resolves to this
     composite — record the dated §F.2 revision.
   - **Q7 (`barMark`):** the group carries one mark for all generated bars.
   - Remaining §F.2 fields unchanged: `barDiameter`, `coverDistance`,
     `barSpacing`, `edgeDistanceStart`, `edgeDistanceEnd`, `orientation`,
     `bars: BarId[]`.
2. **`ReinforcementBar`** (`src/data/models/reinforcement.ts`) gains
   **`barMark: number`** (Q7) and **`placementGroupId?: string`** (the Q6
   detach handle). **Ripple control:** the new required field touches
   `placeBar`/`addBar` and possibly IFC mapping + existing fixtures/tests —
   keep ALL gates green; individuals get the next free mark at placement per
   Q7-a. **No IFC adapter behavior change** (plan scope: groups/barMark do
   not enter IFC — results stay the only exported intent).
3. **`ProjectModel`** (`src/data/models/project.ts`) gains
   **`placementGroups: Record<string, PlacementGroup>`** + the project-level
   **next-mark counter** (Q7's in-task decision — record its home in the task
   log). The header comment ("Later milestones extend this with …
   placementGroups (M3)") resolves — dated note.
4. **project-slice reducers:** add/update/remove group + **batch add/remove of
   group bars** (ONE reducer per batch — the M2 DXF-document precedent — so
   T3's regenerate stays ONE undo level and avoids the F3 per-bar-produce
   cost class where avoidable). Reducer-level tests: exact restore, id
   stability.

## Explicitly NOT T1

No §N commands (T3), no engine math (T2), no UI. The registry-probe maps stay
unchanged (no new commands). Manual test list may be "nothing user-visible —
regression check only" for this headless task.

## Rules (README → Rules for Implementation Sessions + §N)

- Data model first — this task IS rule 4; doors stay open (re-read the plan's
  door check before any structural choice).
- Gates green ONCE before review: `pnpm lint` + `pnpm test` + `pnpm build`
  (cargo untouched in T1).
- Task report ends with the manual test list (rule 7); after author approval
  the list is persisted in `docs/test-scenarios/m3-real-bar-placement.md`
  (create the file on first approval, T1 or whichever task first has one).

## Closing checklist (Rule 9 — on author approval)

1. Gates green ONCE (no re-running).
2. Task commit — the tracker's T1 `Commit:` cell stays `—`.
3. `Tracker: record T1 hash (<hash>)` commit (fills the hash; the
   `m3-t2-session-prompt.md` file lands in this hash commit too).
4. Push. NEVER amend.
