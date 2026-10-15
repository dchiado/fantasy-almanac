import React, { useState, useEffect } from "react";
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import StatTable from "../ui/StatTable";
import { useSelector } from "react-redux";
import './Standings.css';
import { fetchApi } from "../../api";

const formatRecord = (rec) => `${rec.wins}-${rec.losses}${rec.ties !== 0 ? '-' + rec.ties : ''}`;

// A season's record, marked when that team won the title or the regular season
const SeasonRecord = ({ rec }) => {
	if (!rec) return null;
	const className = [
		'season-record',
		rec.playoff_champ && 'champ',
		rec.reg_season_champ && 'reg-champ',
	].filter(Boolean).join(' ');

	return (
		<span className={className}>
			{rec.playoff_champ && <EmojiEventsIcon sx={{ fontSize: 14 }} />}
			{formatRecord(rec)}
		</span>
	);
}

const Standings = ({ setError }) => {
	const leagueId = useSelector((state) => state.leagueInfo.id)

	const [standingsData, setStandingsData] = useState({});
	const [seasons, setSeasons] = useState([]);
	const [allSeasons, setAllSeasons] = useState([]);
	const [currentSeason, setCurrentSeason] = useState([]);
	const [standingsRows, setStandingsRows] = useState([]);
	const [allRows, setAllRows] = useState([]);
	const [loading, setLoading] = useState(true);

	const [startYear, setStartYear] = useState('');
	const [endYear, setEndYear] = useState('');
	const [activeTeams, setActiveTeams] = useState(false);

	useEffect(() => {
		if (Object.keys(standingsData).length === 0 && leagueId) {
			fetchApi(`/standings?leagueId=${leagueId}`)
			.then((data) => {
				setStandingsData(data);
			})
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});	
		}
	}, [standingsData, leagueId, setError]);

	useEffect(() => {
		if (Object.keys(standingsData).length > 0 && standingsRows.length === 0) {
			const standingsJson = JSON.parse(JSON.stringify(standingsData));
			setStandingsRows(standingsJson.teams);
			setAllRows(standingsJson.teams);
			setSeasons(standingsJson.seasons);
			setAllSeasons(standingsJson.seasons);
			setCurrentSeason(standingsJson.seasons.slice(-1)[0]);
			setStartYear(standingsJson.seasons.slice(0)[0]);
			setEndYear(standingsJson.seasons.slice(-1)[0]);
			setLoading(false);
		}
	}, [standingsData, standingsRows]);

	const handleStartYearChange = (event) => {
    const year = event.target.value;
		const startIdx = allSeasons.indexOf(year);
		const endIdx = allSeasons.indexOf(endYear);
		setStartYear(year);
		setSeasons(allSeasons.slice(startIdx, endIdx + 1));
  };

	const handleEndYearChange = (event) => {
    const year = event.target.value;
		const startIdx = allSeasons.indexOf(startYear);
		const endIdx = allSeasons.indexOf(year);
		setEndYear(year);
		setSeasons(allSeasons.slice(startIdx, endIdx + 1));
  };

	const handleFilterActive = (event) => {
		setActiveTeams(event.target.checked);
	}
	
	useEffect(() => {
		if (activeTeams) {
			setStandingsRows(allRows.filter((r) => r.seasons.some(e => e.year === currentSeason)));
		} else {
			setStandingsRows(allRows.filter((r) => r.seasons.some(e => seasons.includes(e.year))));
		}
	}, [activeTeams, allRows, currentSeason, seasons])

	const sum = (row, field) => row.seasons.reduce((accu, s) => seasons.includes(s.year) ? accu + s[field] : accu, 0);

	const tableRows = standingsRows.map((row) => {
		const wins = sum(row, 'wins');
		const losses = sum(row, 'losses');
		const ties = sum(row, 'ties');
		const winPct = wins + losses === 0 ? '' : (wins / (wins + losses) * 100).toFixed(2) + '%';
		return { ...row, wins, losses, ties, winPct };
	});

	const columns = [
		{ key: 'name', label: 'Owner', sticky: true, minWidth: 120, cellSx: () => ({ fontWeight: 600 }) },
		...seasons.map((year) => ({
			key: String(year),
			label: year,
			align: 'center',
			render: (row) => <SeasonRecord rec={row.seasons.find((r) => r.year === year)} />,
		})),
		{ key: 'wins', label: 'W', numeric: true, cellSx: () => ({ fontWeight: 600 }) },
		{ key: 'losses', label: 'L', numeric: true },
		{ key: 'ties', label: 'T', numeric: true },
		{ key: 'winPct', label: 'Win %', numeric: true, cellSx: () => ({ fontWeight: 600 }) },
	];

	const yearSelect = (id, label, value, onChange) => (
		<FormControl sx={{ minWidth: 110, flex: 1 }}>
			<InputLabel id={`${id}-label`}>{label}</InputLabel>
			<Select labelId={`${id}-label`} id={id} value={value} label={label} onChange={onChange}>
				{allSeasons.map((year) => <MenuItem value={year} key={year}>{year}</MenuItem>)}
			</Select>
		</FormControl>
	);

	if (loading) {
		return <LoadingState rows={12} />;
	}

	return (
		<PageLayout
			maxWidth={1600}
			title="All-time Standings"
			subtitle={`${seasons[0]}–${seasons[seasons.length - 1]} · ${tableRows.length} owners`}
			actions={
				<Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
					<FormControlLabel
						control={<Switch checked={activeTeams} onChange={handleFilterActive} />}
						label="Active teams only"
						sx={{ mr: 1 }}
					/>
					<Box sx={{ display: 'flex', gap: 1.5, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>
						{yearSelect('select-start-year', 'From', startYear, handleStartYearChange)}
						{yearSelect('select-end-year', 'To', endYear, handleEndYearChange)}
					</Box>
				</Box>
			}
		>
			{tableRows.length > 0 &&
				<>
					<StatTable
						columns={columns}
						rows={tableRows}
						getRowKey={(row) => row.name}
						ariaLabel="All-time standings"
					/>
					<Box className="standings-legend">
						<span className="season-record champ"><EmojiEventsIcon sx={{ fontSize: 14 }} />League champ</span>
						<span className="season-record reg-champ">Regular season champ</span>
					</Box>
				</>
			}
		</PageLayout>
	);
}

export default Standings;
