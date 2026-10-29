import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  startYear: null,
  teams: null,
  currentYear: null,
  currentWeek: null,
  id: null
}

export const leagueInfoSlice = createSlice({
  name: 'leagueInfo',
  initialState,
  reducers: {
    updateLeagueInfo(_state, action) {
      return action.payload
    },
    clearLeagueInfo() {
      return initialState
    },
  },
})

export const { updateLeagueInfo, clearLeagueInfo } = leagueInfoSlice.actions

export default leagueInfoSlice.reducer

