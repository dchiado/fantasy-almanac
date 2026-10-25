import React from "react";
import { useSelector } from 'react-redux'
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useCookies } from "react-cookie";
import { Box, Typography } from "@mui/material";
import SectionCard from "../ui/SectionCard";
import LeagueDashboard from "./LeagueDashboard";

const LeagueInfo = ({ onLeagueIdChange, onLeagueInfoSubmit }) => {
	const leagueInfo = useSelector((state) => state.leagueInfo)
	const [cookies,,] = useCookies(["league_id"]);

	if (cookies?.league_id && leagueInfo.name) {
		return <LeagueDashboard leagueInfo={leagueInfo} />;
	}

	return (
		<Box sx={{ width: '100%', maxWidth: 480, px: 2, py: { xs: 5, sm: 8 }, boxSizing: 'border-box', textAlign: 'left' }}>
			<Typography variant="h4" component="h1" sx={{ mt: 1 }}>Your fantasy league's history</Typography>
			<Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
				All-time standings, rivalries, records and weekly power rankings for your ESPN fantasy football league.
			</Typography>

			<SectionCard>
				<Box component="form" onSubmit={onLeagueInfoSubmit} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
					<TextField
						id="league-id"
						label="ESPN league ID"
						onChange={onLeagueIdChange}
						onKeyPress={(event) => {
							// Digits only, but let Enter through so the form still submits
							if (event.key.length === 1 && !/[0-9]/.test(event.key)) {
								event.preventDefault();
							}
						}}
						inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
						fullWidth
					/>
					<Button variant="contained" type="submit" sx={{ flexShrink: 0, height: 40 }}>
						Go
					</Button>
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
					Find it in your league page's URL, after <code>leagueId=</code>. Private leagues will be asked
					for an <code>espn_s2</code> cookie.
				</Typography>
			</SectionCard>
		</Box>
	);
}

export default LeagueInfo;
