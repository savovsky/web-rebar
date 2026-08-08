import { createSlice } from '@reduxjs/toolkit';

interface ScheduleState {
  marks: unknown[];
  totalWeight: number;
  totalCount: number;
}

const initialState: ScheduleState = {
  marks: [],
  totalWeight: 0,
  totalCount: 0,
};

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {},
});

export default scheduleSlice.reducer;
