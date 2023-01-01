import { configureStore } from '@reduxjs/toolkit'
import leagueInfoReducer from './features/leagueInfo/leagueInfoSlice'

export const store = configureStore({
  reducer: {
    leagueInfo: leagueInfoReducer,
  },
})

