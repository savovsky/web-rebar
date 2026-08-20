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
      // serializableCheck (dev-only): reference-solid documents hold
      // Float32/Uint32Array meshes in ProjectModel (M2 plan Q7-a — a dated
      // §H.1 bend so undo snapshots stay frozen-reference-cheap). Typed
      // arrays trip the dev non-serializable warnings on every dispatch, so
      // the solids subtrees are excluded here — narrowly: the reference
      // document subtrees (state + snapshots) and the solids-bearing action
      // payloads. Immer itself treats typed arrays as opaque leaves (never
      // drafted/frozen), so the immutable check is unaffected. The M1 T5
      // benchmark store (production middleware set) disables both checks
      // wholesale — nothing to change there.
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActionPaths: ['payload.solids', /^payload\.referenceDocuments\./],
          ignoredPaths: [/^project\.referenceDocuments\./, /^undo\.(past|future)\.\d+\.referenceDocuments\./],
        },
      })
        .prepend(undoScopeMiddleware)
        .concat(undoListenerMiddleware.middleware),
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
