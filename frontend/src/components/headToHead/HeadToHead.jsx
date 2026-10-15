import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import './HeadToHead.css';
import { fetchApi } from "../../api";

const formatPoints = (n) => Number(n).toFixed(2);

const TeamBadge = ({ team, align }) => (
	<Box sx={{ display: 'flex', flexDirection: 'column', alignItems: align, gap: 1, minWidth: 0, textAlign: align === 'flex-start' ? 'left' : 'right' }}>
		<img className="h2h-logo" src={team.logo} alt={`${team.name} logo`} />
		<Typography sx={{ fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{team.name}</Typography>
	</Box>
);

// One stat: both values with the leader highlighted, over a bar split by each side's share
const CompareRow = ({ label, a, b, format = (n) => n }) => {
	const total = Number(a) + Number(b);
	const share = total > 0 ? (Number(a) / total) * 100 : 50;
	const lead = Number(a) === Number(b) ? 0 : Number(a) > Number(b) ? -1 : 1;

	return (
		<Box className="h2h-row">
			<Box className="h2h-row-values">
				<span className={lead === -1 ? 'leader' : ''}>{format(a)}</span>
				<Typography component="span" variant="body2" color="text.secondary">{label}</Typography>
				<span className={lead === 1 ? 'leader' : ''}>{format(b)}</span>
			</Box>
			<Box className="h2h-bar" aria-hidden="true">
				<span className={lead === -1 ? 'leader' : ''} style={{ width: `${share}%` }} />
				<span className={lead === 1 ? 'leader' : ''} style={{ width: `${100 - share}%` }} />
			</Box>
		</Box>
	);
}

const streakText = (streak, a, b) => {
	if (!streak?.length) return '—';
	const holder = streak.team === a.owner_id ? a : b;
	return `${holder.name} · W${streak.length}`;
}

const Matchup = ({ data, a, b }) => (
	<SectionCard sx={{ p: { xs: 2, sm: 4 } }}>
		<Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: { xs: 1.5, sm: 3 } }}>
			<TeamBadge team={a} align="flex-start" />
			<Box sx={{ textAlign: 'center' }}>
				<Typography className="h2h-record" component="div">
					<span className={a.reg_wins > b.reg_wins ? 'leader' : ''}>{a.reg_wins}</span>
					<Box component="span" sx={{ color: 'text.disabled', mx: 0.75 }}>–</Box>
					<span className={b.reg_wins > a.reg_wins ? 'leader' : ''}>{b.reg_wins}</span>
				</Typography>
				<Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2, display: 'block' }}>
					All-time{a.reg_ties > 0 ? ` · ${a.reg_ties} tie${a.reg_ties === 1 ? '' : 's'}` : ''}
				</Typography>
			</Box>
			<TeamBadge team={b} align="flex-end" />
		</Box>

		<Typography variant="overline" component="h3" color="text.secondary" sx={{ display: 'block', mt: 3, mb: 1 }}>Regular season</Typography>
		<CompareRow label="Wins" a={a.reg_wins} b={b.reg_wins} />
		<CompareRow label="Points" a={a.reg_points} b={b.reg_points} format={formatPoints} />

		<Typography variant="overline" component="h3" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>Playoffs</Typography>
		<CompareRow label="Wins" a={a.playoff_wins} b={b.playoff_wins} />
		<CompareRow label="Points" a={a.playoff_points} b={b.playoff_points} format={formatPoints} />

		<Typography variant="overline" component="h3" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>Streaks</Typography>
		<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
			<Chip label={<><strong>Current</strong> {streakText(data.current_streak, a, b)}</>} variant="outlined" />
			<Chip label={<><strong>Longest</strong> {streakText(data.longest_streak, a, b)}</>} variant="outlined" />
		</Box>
	</SectionCard>
);

const HeadToHead = ({ setError }) => {
	const leagueId = useSelector((state) => state.leagueInfo.id)

	const [loading, setLoading] = useState(false);
	const [teams, setTeams] = useState([]);
	const [teamsSubmitted, setTeamsSubmitted] = useState(false);
	const [team1, setTeam1] = useState('');
	const [team2, setTeam2] = useState('');
	const [matchupData, setMatchupData] = useState({});

	useEffect(() => {
		if (teams.length === 0 && leagueId) {
			fetchApi(`/head-to-head-form?leagueId=${leagueId}`)
			.then((data) => {
				setTeams(data);
			})
			.catch((error) => {
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});
		}
	}, [teams, leagueId, setError]);

	useEffect(() => {
		if (Object.keys(matchupData).length === 0 && teamsSubmitted && leagueId) {
			setLoading(true);
			fetchApi(`/head-to-head?leagueId=${leagueId}&team1=${team1}&team2=${team2}`)
			.then((data) => {
				setMatchupData(JSON.parse(JSON.stringify(data)));
				setLoading(false);
			})
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});
		}
	}, [matchupData, team1, team2, teamsSubmitted, leagueId, setError])

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

	const teamSelect = (n, value, onChange) => (
		<FormControl fullWidth required>
			<InputLabel id={`select-team${n}-label`}>{`Team ${n}`}</InputLabel>
			<Select
				labelId={`select-team${n}-label`}
				id={`select-team${n}`}
				value={value}
				label={`Team ${n}`}
				name={`team${n}`}
				onChange={onChange}
				required
			>
				{teams.map((t) => <MenuItem value={t.owner_id} key={t.owner_id}>{t.name}</MenuItem>)}
			</Select>
		</FormControl>
	);

	if (loading || teams.length === 0) {
		return <LoadingState variant="card" />;
	}

	return (
		<PageLayout maxWidth={800} title="Head-to-Head" subtitle="The full rivalry history between any two teams.">
			{Object.keys(matchupData).length === 0 &&
				<SectionCard>
					<Box
						component="form"
						onSubmit={handleSubmit}
						sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2 }}
					>
						{teamSelect(1, team1, handleSelectTeam1)}
						<Typography color="text.secondary" sx={{ fontWeight: 600 }}>vs</Typography>
						{teamSelect(2, team2, handleSelectTeam2)}
						<Button variant="contained" size="large" type="submit" sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}>
							Compare
						</Button>
					</Box>
				</SectionCard>
			}
			{Object.keys(matchupData).length !== 0 &&
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
					<Matchup data={matchupData} a={matchupData[team1]} b={matchupData[team2]} />
					<Box sx={{ textAlign: 'center' }}>
						<Button variant="outlined" onClick={handleChangeTeams}>Choose new teams</Button>
					</Box>
				</Box>
			}
		</PageLayout>
	);
}

export default HeadToHead;
