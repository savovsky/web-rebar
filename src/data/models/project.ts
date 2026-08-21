/**
 * Root project model — the persisted document (§H.1 subset for M0, extended
 * at M2 T5 and M3 T1).
 * Everything here is JSON-serializable; derived data (meshes, section
 * primitives, undo stack, camera state) is never part of it (§H.2).
 * Later milestones extend this with: storeys, layers, annotations, layouts.
 * (Header note resolved 2026-08-21, M3 T1: placementGroups landed below —
 * exactly where §H.1's ProjectFile interface already anticipated it.)
 */
import type { ConcreteElement } from './elements';
import type { PlacementGroup } from './placement-groups';
import type { ReferenceDocument } from './reference-documents';
import type { ReinforcementBar } from './reinforcement';
import type { SectionDefinition } from './sections';

export interface ProjectMetadata {
  name: string;
  /** ISO 8601 timestamps. */
  createdAt: string;
  lastModified: string;
  appVersion: string;
}

export interface ProjectModel {
  /** Project-file format version (§H.1) — migrations key off this. */
  version: string;
  metadata: ProjectMetadata;
  /** Entity dictionaries keyed by id (normalized — RTK/Immer-friendly). */
  elements: Record<string, ConcreteElement>;
  reinforcement: Record<string, ReinforcementBar>;
  sections: Record<string, SectionDefinition>;
  /** Imported background linework (M2 plan Q3) — inert reference, never
   *  edited/picked/sectioned/computed; deliberately NOT the Layer Model. */
  referenceDocuments: Record<string, ReferenceDocument>;
  /** Placement rules (§F.2 — M3 T1): groups keyed by id. A group is a
   *  placement RULE, never a visibility/freeze/lock scope — the Layer Model
   *  stays a deferred topic (M3 plan door check). */
  placementGroups: Record<string, PlacementGroup>;
  /** Next free position number (M3 plan Q7-a — in-task decision recorded in
   *  the M3 tracker): individual bars take it at placement, a group takes ONE
   *  mark for all its generated bars; user-editing of marks is §J scope. */
  nextBarMark: number;
}
