import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type ToolId = 'select' | 'placeWall' | 'placeBar' | 'sectionCut' | 'pan' | 'orbit'

interface UiState {
  activeTool: ToolId
  sticky: boolean
  cursorHint: string
  isInProgress: boolean
}

const initialState: UiState = {
  activeTool: 'select',
  sticky: false,
  cursorHint: '',
  isInProgress: false,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTool(state, action: PayloadAction<{ tool: ToolId; sticky?: boolean }>) {
      state.activeTool = action.payload.tool
      state.sticky = action.payload.sticky ?? false
      state.cursorHint = ''
      state.isInProgress = false
    },
    setCursorHint(state, action: PayloadAction<string>) {
      state.cursorHint = action.payload
    },
    setInProgress(state, action: PayloadAction<boolean>) {
      state.isInProgress = action.payload
    },
  },
})

export const { setTool, setCursorHint, setInProgress } = uiSlice.actions
export default uiSlice.reducer