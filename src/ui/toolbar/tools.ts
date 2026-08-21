// Tool palette metadata (§B.6): the M0 set plus the M1 Move tool — the first
// Modify-category entry (Q3-b). Shortcuts come from shortcuts.json — the
// single, user-editable (post-M0) mapping. Orbit has no button: it is native
// mouse input (right/middle-drag), but keeps a definition so the status bar
// can describe it.
import type { ComponentType } from 'react';
import type { ToolId } from '@/stores/ui-slice';
import {
  IconMove,
  IconOrbit,
  IconPan,
  IconPlaceBar,
  IconPlaceBarGroup,
  IconPlaceWall,
  IconSectionCut,
  IconSelect,
} from './icons';
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
    id: 'move',
    label: 'Move',
    hint: 'Drag a wall to move it — its bars follow · Shift disables snap · Esc cancels',
    shortcut: SHORTCUT_BY_TOOL.move ?? null,
    icon: IconMove,
  },
  {
    id: 'placeWall',
    label: 'Place Wall',
    hint: 'Click the start point · each further click completes a wall and starts the next · Esc to finish',
    shortcut: SHORTCUT_BY_TOOL.placeWall ?? null,
    icon: IconPlaceWall,
  },
  {
    id: 'placeBar',
    label: 'Place Bar',
    hint: 'Click a wall face, then the bar path — each click adds a segment to one bar · Esc to finish',
    shortcut: SHORTCUT_BY_TOOL.placeBar ?? null,
    icon: IconPlaceBar,
  },
  {
    id: 'placeBarGroup',
    label: 'Place Bar Group',
    hint: 'Click a wall face to capture it · drag or click-click a region · Enter places the group · Esc cancels',
    shortcut: SHORTCUT_BY_TOOL.placeBarGroup ?? null,
    icon: IconPlaceBarGroup,
  },
  {
    id: 'sectionCut',
    label: 'Section Cut',
    hint: 'Drag the section line across an element, then click to set the view depth · Esc to cancel',
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

/** The clickable tools — orbit is mouse-native and has no button. */
export const TOOLBAR_TOOLS = TOOL_DEFINITIONS.filter((tool) => tool.id !== 'orbit');

export const TOOL_BY_ID = new Map<ToolId, ToolDefinition>(TOOL_DEFINITIONS.map((tool) => [tool.id, tool]));
