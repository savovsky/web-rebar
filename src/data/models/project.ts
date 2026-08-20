/**
 * Root project model — the persisted document (§H.1 subset for M0).
 * Everything here is JSON-serializable; derived data (meshes, section
 * primitives, undo stack, camera state) is never part of it (§H.2).
 * Later milestones extend this with: storeys, layers, placementGroups (M3),
 * annotations, layouts.
 */
import type { ConcreteElement } from './elements';
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
}
