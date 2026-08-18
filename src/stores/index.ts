import { configureStore } from '@reduxjs/toolkit';
import projectReducer from './project-slice';
import scheduleReducer from './schedule-slice';
import uiReducer from './ui-slice';
import { undoListenerMiddleware, undoScopeMiddleware } from './undo-middleware';
import undoReducer from './undo-slice';

/**
 * Store factory — command tests (T5) and the future headless MCP/scripting door
 * (§N.2) create isolated instances; the running app uses the singleton below.
 * The undo middleware chain (§E, Q1-a) is registered here, so every store —
 * headless or app — records command history automatically. Order matters:
 * undoScopeMiddleware must wrap thunk invocation (prepended before the thunk
 * middleware); the listener runs after the default middleware.
 */
export const createAppStore = () =>
  configureStore({
    reducer: {
      project: projectReducer,
      schedule: scheduleReducer,
      ui: uiReducer,
      undo: undoReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().prepend(undoScopeMiddleware).concat(undoListenerMiddleware.middleware),
  });

export const store = createAppStore();

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/**
 * Typed thunk for the §N command layer: command factories take one plain params
 * object and return an AppThunk; components dispatch it and never decide (§N.1).
 */
export type AppThunk<TReturn = void> = (dispatch: AppDispatch, getState: () => RootState) => TReturn;
