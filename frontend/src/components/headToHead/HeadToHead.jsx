import { Button, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";
import './HeadToHead.css';

const HeadToHead = () => {
	const leagueId = useSelector((state) => state.leagueInfo.id)

	const [loading, setLoading] = useState(false);
	const [teams, setTeams] = useState([]);
	const [teamsSubmitted, setTeamsSubmitted] = useState(false);
	const [team1, setTeam1] = useState('');
	const [team2, setTeam2] = useState('');
	const [matchupData, setMatchupData] = useState({});

	useEffect(() => {
		if (teams.length === 0 && leagueId) {
			fetch(
				`${process.env.REACT_APP_API_URL}/head-to-head-form?leagueId=${leagueId}`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			).then((res) =>
				res.json().then((data) => {
					setTeams(data);
				})
			);
		}
	}, [teams, leagueId]);

	useEffect(() => {
		if (Object.keys(matchupData).length === 0 && teamsSubmitted && leagueId) {
			setLoading(true);
			fetch(
				`${process.env.REACT_APP_API_URL}/head-to-head?leagueId=${leagueId}&team1=${team1}&team2=${team2}`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			).then((res) =>
				res.json().then((data) => {
					setMatchupData(JSON.parse(JSON.stringify(data)));
					setLoading(false);
				})
			);
		}
	}, [matchupData, team1, team2, teamsSubmitted, leagueId])

	const handleSelectTeam1 = (event) => {
		setTeam1(event.target.value);
	}

	const handleSelectTeam2 = (event) => {
		setTeam2(event.target.value);
	}

	const handleSubmit = (event) => {
		event.preventDefault();
		setTeamsSubmitted(true);
	}

	const handleChangeTeams = () => {
		setTeamsSubmitted(false);
		setTeam1('');
		setTeam2('');
		setMatchupData({});
	}

	return (
		<div className="head-to-head-content">
			{loading && <LoadingSpinner />}
			{(teams.length > 0 && Object.keys(matchupData).length === 0 && !loading) &&
				<form onSubmit={handleSubmit} className="head-to-head-form">
					<FormControl sx={{ minWidth: 200 }}>
						<InputLabel id='select-team1-label' sx={{ color: 'white' }}>Team</InputLabel>
						<Select
							labelId='select-team1-label'
							id='select-team1'
							value={team1}
							label='Team 1'
							name='team1'
							onChange={handleSelectTeam1}
							required
							sx={{ color: 'white' }}
						>
							{teams.map((t) => <MenuItem value={t.owner_id} key={t.owner_id}>{t.name}</MenuItem>)}
						</Select>
					</FormControl>
					vs.
					<FormControl >
						<InputLabel id='select-team2-label' sx={{ color: 'white' }}>Team</InputLabel>
						<Select
							labelId='select-team2-label'
							id='select-team2'
							value={team2}
							label='Team 2'
							name='team2'
							onChange={handleSelectTeam2}
							required
							sx={{ color: 'white' }}
						>
							{teams.map((t) => <MenuItem value={t.owner_id} key={t.owner_id}>{t.name}</MenuItem>)}
						</Select>
					</FormControl>
					<Button variant="contained" type="submit" value="Submit">Submit</Button>
				</form>
			}
			{Object.keys(matchupData).length !== 0 &&
				<div className="h2h-content">
					<div className="h2h-details">
						<div className="h2h-team-column">
							<img src={matchupData[team1].logo} height="120" width="120" alt="team logo 1"></img>
							<div>{matchupData[team1].name}</div>
							<div className="section-header"></div>
							<div>{matchupData[team1].reg_wins}</div>
							<div>{matchupData[team1].reg_ties}</div>
							<div>{matchupData[team1].reg_points}</div>
							<div className="section-header"></div>
							<div>{matchupData[team1].playoff_wins}</div>
							<div>{matchupData[team1].playoff_points}</div>
							<div className="section-header"></div>
							<div>{(matchupData.current_streak.team === matchupData[team1].owner_id ? 'W' : 'L') + matchupData.current_streak.length}</div>
							<div>{(matchupData.longest_streak.team === matchupData[team1].owner_id ? 'W' : 'L') + matchupData.longest_streak.length}</div>
						</div>
						<div className="h2h-team-column bold">
							<div className="img-row"></div>
							<div>Team</div>
							<div className="section-header">Regular Season</div>
							<div>Wins</div>
							<div>Ties</div>
							<div>Points</div>
							<div className="section-header">Playoffs</div>
							<div>Wins</div>
							<div>Points</div>
							<div className="section-header">Streaks</div>
							<div>Current</div>
							<div>Longest</div>
						</div>
						<div className="h2h-team-column">
							<img src={matchupData[team2].logo} height="120" alt="team logo 1"></img>
							<div>{matchupData[team2].name}</div>
							<div className="section-header"></div>
							<div>{matchupData[team2].reg_wins}</div>
							<div>{matchupData[team2].reg_ties}</div>
							<div>{matchupData[team2].reg_points}</div>
							<div className="section-header"></div>
							<div>{matchupData[team2].playoff_wins}</div>
							<div>{matchupData[team2].playoff_points}</div>
							<div className="section-header"></div>
							<div>{(matchupData.current_streak.team === matchupData[team2].owner_id ? 'W' : 'L') + matchupData.current_streak.length}</div>
							<div>{(matchupData.longest_streak.team === matchupData[team2].owner_id ? 'W' : 'L') + matchupData.longest_streak.length}</div>
						</div>
					</div>
					<br></br>
					<Button variant="contained" onClick={handleChangeTeams} sx={{ marginBottom: '20px' }}>Choose new teams</Button>
				</div>
			}
		</div>
	);
}

export default HeadToHead;
