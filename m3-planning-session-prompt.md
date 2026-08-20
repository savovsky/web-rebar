# ⚠️ TEMP session prompt — M3 PLANNING (no code; the plan gets approved before implementation)

> Point a fresh AI session at this file (or paste its content). **Delete this file once the session starts** — the durable record is the resulting M3 plan document. Created 2026-08-18 after **M2 ✅ COMPLETE** (T1–T8; IFC round-trip proven headless AND in the browser; DXF background import/render/snap; foreign IFC as render-only reference solids — Q7; DXF section export author-verified in Allplan 2022; acceptance pass green — commit `20cf7d3` + hash-commit `e17c05a`, pushed). Branch `A_MVP_Scope_M2` closed at M2.

I'm working on a browser-based reinforced concrete drawing app ("web-rebar").
Read C:\work\personal\projects\web-rebar\README.md first — it has session state
(M0 + M1 + M2 ✅ complete; M3 has **no approved plan yet** — this session is the
M3 PLANNING session, not a task) and the Rules for Implementation Sessions.
Then read docs/08-architecture-spec.md (§A milestones, §F Reinforcement
Placement, §N, and the Deferred Topics table) and the M2 tracker
docs/implementation-plans-and-tasks/m2-adapters-round-trip.md for the
door-check pattern and task granularity to reuse.

Task: **draft the M3 (Real Bar Placement) implementation PLAN — plan document
only, no code.** The plan gets committed by the author as a docs-only change
once approved; implementation sessions start on a NEW branch
(`A_MVP_Scope_M3`) only after approval.

Do NOT write implementation code in this session. Do NOT commit yourself —
present the draft plan file for review; the author commits it.

---

## M3 scope seed (from §A — "Real Bar Placement" in the milestone table)

Deliverable: **multi-bar placement on a face with spacing, cover, and edge
distance** — the §F.2 Individual (fire-and-forget stays) **and Group**
(rule-based region placement) modes. Risks to probe: the face-sampling
algorithm; collision detection (bar vs bar, bar vs openings); placement UX
(group-region definition on a face).

Required plan sections — mirror the M2 plan structure exactly:

1. **Goal** (what the milestone proves + the risks probed — from §A).
2. **Scope table**: in scope / explicitly out (with the why) — e.g. bar groups
   per §F.2, face sampling, cover/spacing/edge params, group edit/regenerate;
   OUT: openings/junctions geometry (M4), §K validation auto-runs (stay
   on-demand), optimize algorithms (§L watch only).
3. **Door check** (MANDATORY — root README planning rule): walk the Deferred
   Topics table + §N; record every door this plan takes (e.g. groupbar defs
   affect the §F-model; Layer Model stays open; edit tools stay the M1 set),
   with explicit non-decisions. Nothing may silently close a deferred door.
4. **Open questions** (a numbered Q-table in the M2 plan style — probe them
   explicitly before the first implementation task lands; ⭐ recommendations
   ready for author approval): face-sampling approach (parametric surface
   sampling vs. mesh sampling), collision-check method (§L's parry3d crate is
   in the tech stack — adopt or pure math?), group params storage (PJ: how
   groups link Faces when model shapes move), group region definition UX
   (draw on face? parametric offsets?), UX for individual-vs-group toggle.
5. **Task breakdown** (T1… scale: M0–M2 ran 5–12 tasks; M3 likely ~6–8):
   typically: data-model + §N commands → W/A/S/M engine math → placement UX
   → group edit/regenerate → collision check → performance probe → acceptance
   pass. Bundles must stay defensible — command group sizes = the M2 pattern.
6. **Task tracker skeleton** (empty table with T1…Tx rows, Commit cells `—`).

Plus:

- Update docs/implementation-plans-and-tasks/README.md (→ M3 row "🔵 In
  planning" with the expl right branch status deferred).
- The plan file must be created at
  docs/implementation-plans-and-tasks/m3-real-bar-placement.md (path pattern).
- The plan file itself should carry the header convention of the M2 plans
  (back-links, approval placeholder, current-state section).

Present: the draft plan + the M1/M2 pattern notes that shaped the task split.
The author approves, then commits the plan file; M3 implementation sessions
(after approval) run on branch `A_MVP_Scope_M3` with the standard gates
(pnpm lint + test + build) and the Rule 9 closing procedure per task.

## 📌 Cleanup before commit

The prompt file itself is deleted once the planning session starts (the
durable record is the plan). The author handles the prompt-file deletion.
