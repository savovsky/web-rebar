# ⏳ TEMPORARY — Next Session Starter (M1 T4)

> **Delete this file once the T4 session has started.** It exists only to bridge
> to a fresh AI session after a break. Everything permanent already lives in the
> canonical docs (root README session state, M1 tracker, Architecture Spec).

**Repo state at creation (2026-08-09):** branch `A_MVP_Scope_M1`, HEAD `7eeded2`.
M1 T1–T3 ✅ done (T3 = `ece79bf`). Working tree clean. 167 vitest + lint + build green.

---

## 1. Copy-paste prompt for the fresh session

```text
I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state,
the Rules for Implementation Sessions, and the Deferred Topics table.
Then read docs/08-architecture-spec.md (locked decisions; §E revised 2026-08-09
to host-follow, §B.5 revised 2026-08-09 with the hover/click picking rules) and
docs/implementation-plans-and-tasks/m1-edit-and-reactivity.md — the M1 plan is
APPROVED; its ▶️ Current State section confirms T4 is next.

Task: implement M1 T4 — the Move tool (M) per the approved plan (§4, Q3-b):
new ToolId 'move' + shortcuts.json entry + toolbar icon (§B.6 rule 5: SVG,
24×24, token-colored); with Move active, pointer-down on a wall begins a
potential drag (click-vs-drag threshold as in the T10 section volumes); live
drag state in component refs (§E — no 60 FPS dispatches); the wall AND its
hosted bars render at the dragged offset locally (ghost or live-offset render,
decided in task); grid snapping applies to the delta (§B.3, Shift disables);
Esc cancels mid-drag; pointer-up → commitElementDrag module (React-free,
mirroring section-volume-drag.ts) → moveElement command (host-follow — one
undo level for wall+bars); single-shot auto-return to Select (§B.6 rule 1,
double-click locks sticky per rule 2); the Select tool never moves elements.
The hover/click picking from T3 (pickPointerWinner, §B.5) must keep working —
decide how Move-tool hover/drag interacts with it. The open 2D section updates
on commit via the memoized selector.

Rules: one task only; end with pnpm lint + pnpm test + pnpm build green and a
manual test list (rule 7); update the M1 tracker (T4 row → 🟡 Review + task log
entry). Do not commit — I review and commit myself (rule 8).
```

---

## 2. ⚠️ The flag: ghost vs live-offset render (decide IN the task)

The approved plan (§4) explicitly leaves this open: *"the wall AND its hosted
bars render at the dragged offset locally (ghost or live-offset render,
decided in task)"*.

- **Ghost preview (recommendation):** the real wall+bars stay at their original
  position; a translucent copy follows the cursor. Clearer for a dedicated Move
  tool — the user sees before/after simultaneously, and an Esc cancel is
  visually trivial (drop the ghost). Matches the existing draft-preview
  vocabulary (WallDraftPreview/BarDraftPreview are translucent).
- **Live-offset:** the real meshes move with the cursor and snap back on Esc.
  This is what T10's section wireframe volumes do (`useSectionDrag` in
  `SectionVolumesLayer.tsx` — local live geometry + one command on pointer-up).
  Simpler (no duplicate render path), but for *content* (wall + bars, not a
  wireframe) a failed/cancelled drag that visually moved the model feels worse.

Either way: drag deltas live in component state/refs (§E — never dispatch at
pointer rate), `moveElement` fires once on pointer-up, and the 2D section
updates only on commit (memoized selector).

## 3. Implementation context discovered in T3 (reuse, don't rediscover)

- **Drag precedent:** `src/ui/viewport/section-volume-drag.ts` (React-free
  commit module) + `useSectionDrag` in `SectionVolumesLayer.tsx` (pointer
  capture, click-vs-drag via `CLICK_DRAG_TOLERANCE_PX`, ground-plane ray →
  snapped point, Esc handling). Mirror this shape for `commitElementDrag`.
- **Picking:** `src/ui/viewport/hover-target.ts` — `pickPointerWinner` +
  transient hover store (`useIsHoverTarget`). Hover is currently gated to the
  Select tool in each mesh's handlers; the Move tool needs its own decision
  (e.g. highlight the movable wall under the cursor, suppress during drag).
  Walls/bars/section volumes carry `userData` entity tags — reuse them for
  move-target picking instead of adding a second picking path.
- **Command ready:** `moveElement({ elementId, delta })` exists since T2 with
  host-follow (wall + hosted bars, one undo level). It accepts a full Vec3 but
  the Move tool drags in plan (`delta.y = 0`) — see the T2 task-log note on
  vertical deltas.
- **Tool plumbing:** `ToolId` union in `src/stores/ui-slice.ts`,
  `src/ui/toolbar/shortcuts.json`, `tools.ts` + `icons.tsx` (SVG 24×24,
  token-colored), `use-tool-shortcuts.ts` (key → tool map is automatic from
  shortcuts.json; Escape already routes to Select + deselect).
- **Sticky/single-shot:** `setTool({ tool, sticky })`; §B.6 rule 1/2. Note the
  chained tools (W/B) don't auto-return — Move is single-shot and MUST
  auto-return after one completed move unless sticky.
- **Guard:** `isEditableTarget` for any new keyboard handling; Delete is inert
  while `isInProgress` — a Move drag should set transient state locally, not
  `isInProgress` (that's the placement-draft flag) unless deliberately reused.
- **Gotchas from T3:** eslint `no-nested-ternary` (use let/if chains), naming
  convention prefixes for booleans (is/has/can/…), prettier import order
  (three before vitest), max-params 2 → options objects, tokens-only styling
  (add tokens to `tokens.css`, never literals in components).
- **Known harmless console warning:** `THREE.Clock` deprecation (R3F 9.7
  internal) — do NOT patch; see the M1 tracker Current State note.

## 4. Definition of done for the session

`pnpm lint` + `pnpm test` + `pnpm build` green → manual test list (rule 7) →
M1 tracker T4 row → 🟡 Review + task log entry → author reviews and commits.
