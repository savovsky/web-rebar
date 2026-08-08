// M0 tool set metadata (§B.6). Shortcuts come from shortcuts.json — the single,
// user-editable (post-M0) mapping. Orbit has no button: it is native mouse input
// (right/middle-drag), but keeps a definition so the status bar can describe it.
import type { ComponentType } from 'react';
import type { ToolId } from '@/stores/ui-slice';
import { IconOrbit, IconPan, IconPlaceBar, IconPlaceWall, IconSectionCut, IconSelect } from './icons';
import shortcuts from './shortcuts.json';

export interface ToolDefinition {
  id: ToolId;
  label: string;
  /** Default status-bar hint while the tool is active (§B.6 rule 4). */
  hint: string;
  /** Keyboard shortcut from shortcuts.json; null = mouse-driven only. */
  shortcut: string | null;
  icon: ComponentType<{ className?: string }>;
}

const SHORTCUT_BY_TOOL = shortcuts as Partial<Record<ToolId, string>>;

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'select',
    label: 'Select',
    hint: 'Click to select · drag for marquee · Esc to deselect',
    shortcut: SHORTCUT_BY_TOOL.select ?? null,
    icon: IconSelect,
  },
  {
    id: 'placeWall',
    label: 'Place Wall',
    hint: 'Click two points for the wall axis, Enter to confirm',
    shortcut: SHORTCUT_BY_TOOL.placeWall ?? null,
    icon: IconPlaceWall,
  },
  {
    id: 'placeBar',
    label: 'Place Bar',
    hint: 'Click a wall face, then two points for the bar path',
    shortcut: SHORTCUT_BY_TOOL.placeBar ?? null,
    icon: IconPlaceBar,
  },
  {
    id: 'sectionCut',
    label: 'Section Cut',
    hint: 'Click-drag across an element to place the section line',
    shortcut: SHORTCUT_BY_TOOL.sectionCut ?? null,
    icon: IconSectionCut,
  },
  {
    id: 'pan',
    label: 'Pan',
    hint: 'Drag to pan · Esc to return to Select',
    shortcut: SHORTCUT_BY_TOOL.pan ?? null,
    icon: IconPan,
  },
  {
    id: 'orbit',
    label: 'Orbit',
    hint: 'Right-drag to orbit · scroll to zoom',
    shortcut: null,
    icon: IconOrbit,
  },
];

/** The five clickable M0 tools — orbit is mouse-native and has no button. */
export const TOOLBAR_TOOLS = TOOL_DEFINITIONS.filter((tool) => tool.id !== 'orbit');

export const TOOL_BY_ID = new Map<ToolId, ToolDefinition>(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
