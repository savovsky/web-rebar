/**
 * §N command layer — the ONLY doorway for project-model mutations.
 *
 * UI event handlers dispatch these thunks and contain no business logic;
 * reducers in the slices are called by commands only (§N.1). The registry maps
 * command names to thunks so any caller — UI, keyboard, test script, or the
 * future MCP server (§N.2) — drives the app through one doorway with one logic.
 */
import { createSection } from './create-section';
import { deleteBar } from './delete-bar';
import { deleteElement } from './delete-element';
import { deleteSection } from './delete-section';
import { extendBar } from './extend-bar';
import { moveElement } from './move-element';
import { placeBar } from './place-bar';
import { placeWall } from './place-wall';
import { redo } from './redo';
import { reshapeSection } from './reshape-section';
import { setActiveSection } from './set-active-section';
import { undo } from './undo';

export { CommandError } from './command-error';
export { createSection } from './create-section';
export { deleteBar } from './delete-bar';
export { deleteElement } from './delete-element';
export { deleteSection } from './delete-section';
export { extendBar } from './extend-bar';
export { moveElement } from './move-element';
export { placeBar } from './place-bar';
export { placeWall } from './place-wall';
export { redo } from './redo';
export { reshapeSection } from './reshape-section';
export { setActiveSection } from './set-active-section';
export { undo } from './undo';
export type { CommandErrorCode } from './command-error';
export type { CreateSectionParams } from './create-section';
export type { DeleteBarParams } from './delete-bar';
export type { DeleteElementParams } from './delete-element';
export type { DeleteSectionParams } from './delete-section';
export type { ExtendBarParams } from './extend-bar';
export type { MoveElementParams } from './move-element';
export type { PlaceBarParams } from './place-bar';
export type { PlaceWallParams } from './place-wall';
export type { ReshapeSectionParams } from './reshape-section';
export type { SetActiveSectionParams } from './set-active-section';

/** Name → thunk map. Names are the stable external API (MCP tools, scripting). */
export const commandRegistry = {
  createSection: { name: 'createSection', thunk: createSection },
  deleteBar: { name: 'deleteBar', thunk: deleteBar },
  deleteElement: { name: 'deleteElement', thunk: deleteElement },
  deleteSection: { name: 'deleteSection', thunk: deleteSection },
  extendBar: { name: 'extendBar', thunk: extendBar },
  moveElement: { name: 'moveElement', thunk: moveElement },
  placeBar: { name: 'placeBar', thunk: placeBar },
  placeWall: { name: 'placeWall', thunk: placeWall },
  redo: { name: 'redo', thunk: redo },
  reshapeSection: { name: 'reshapeSection', thunk: reshapeSection },
  setActiveSection: { name: 'setActiveSection', thunk: setActiveSection },
  undo: { name: 'undo', thunk: undo },
} as const;

export type CommandName = keyof typeof commandRegistry;
