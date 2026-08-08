import { configureStore } from '@reduxjs/toolkit';
import projectReducer from './project-slice';
import scheduleReducer from './schedule-slice';
import uiReducer from './ui-slice';

export const store = configureStore({
  reducer: {
    project: projectReducer,
    schedule: scheduleReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
