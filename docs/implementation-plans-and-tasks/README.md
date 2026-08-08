# Implementation Plans & Tasks

> **Back to:** [README.md](../../README.md)

This folder holds the **approved implementation plan for each milestone** and the **live task state** for it. It exists so that a fresh AI session (or the author) can resume implementation without re-reading the whole chat history.

## How to use

1. **Fresh session?** Read the root [README.md](../../README.md) first, then [08-architecture-spec.md](../08-architecture-spec.md), then open the **current milestone file** from the index below. Its header tells you exactly which task is next and what is already done.
2. **Plans are approved before coding.** The plan section of a milestone file is the version the author approved — do not deviate silently; raise deviations explicitly and record them in the file's Change Log.
3. **Task states** are updated as work proceeds:
   - `⬜ Pending` — not started
   - `🔵 In progress` — being worked on
   - `🟡 Review` — code written, lint/build green, waiting for the author to review and commit
   - `✅ Done` — reviewed, approved, and committed by the author
4. **Commit discipline:** the implementing session does NOT commit. Each task's changes are reviewed by the author, who commits them. The task row's "Commit" column records the commit hash once done.

## Rules that apply to every task

From root README → "Rules for Implementation Sessions": command layer only (§N), dumb components, stateless WASM, data model first, doors stay open, design tokens only. Every task must end with `pnpm lint` and `pnpm build` green.

## Milestone index

| Milestone | File | Status |
|---|---|---|
| M0: One Wall, One Bar | [m0-one-wall-one-bar.md](./m0-one-wall-one-bar.md) | 🔵 In progress — T1 ✅ T2 ✅, next: T3 |
| M1: Edit + Reactivity | — | ⬜ Not planned |
| M2: IFC Round-Trip | — | ⬜ Not planned |
| M3: Real Bar Placement | — | ⬜ Not planned |
| M4: Multi-Element Building | — | ⬜ Not planned |
