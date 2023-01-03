import React, { useState, useEffect } from "react";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";
import { useSelector } from "react-redux";
import './Standings.css';

const headers = [ 'Wins', 'Losses', 'Ties', 'Win %' ]

const Standings = () => {
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
			fetch(`${process.env.REACT_APP_API_URL}/standings?leagueId=${leagueId}`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			).then((res) =>
				res.json().then((data) => {
					setStandingsData(data);
				})
			);
		}
	}, [standingsData, leagueId]);

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

	return (
		<div className="standings-content">
			{loading ? <LoadingSpinner /> :
				<div className="filters">
					<FormGroup>
						<FormControlLabel
							control={
								<Switch onChange={handleFilterActive}/>
							}
							label="Active Teams"
						/>
					</FormGroup>

					<div className="year-filter">
						<FormControl fullWidth>
							<InputLabel id='select-start-year-label' sx={{ color: 'white' }}>Start Year</InputLabel>
							<Select
								labelId='select-start-year-label'
								id='select-start-year'
								value={startYear}
								label='startYear'
								onChange={handleStartYearChange}
								sx={{ color: 'white' }}
							>
								{standingsData.seasons.map((year) => <MenuItem value={year} key={year}>{year}</MenuItem>)}
							</Select>
						</FormControl>
						<FormControl fullWidth>
							<InputLabel id='select-end-year-label' sx={{ color: 'white' }}>End Year</InputLabel>
							<Select
								labelId='select-end-year-label'
								id='select-end-year'
								value={endYear}
								label='endYear'
								onChange={handleEndYearChange}
								sx={{ color: 'white' }}
							>
								{standingsData.seasons.map((year) => <MenuItem value={year} key={year}>{year}</MenuItem>)}
							</Select>
						</FormControl>
					</div>
				</div>
			}

			{Object.keys(standingsRows).length > 0 &&
				<div className="table-content">
					<TableContainer component={Paper} className="table-container" sx={{ borderRadius: 3 }}>
						<Table sx={{ minWidth: 650, fontSize: 13, borderCollapse: 'separate', borderSpacing: '0' }} size="small" aria-label="standings table">
							<TableHead>
								<TableRow className="table-header">
									<TableCell 
										sx={{
											minWidth: 105,
											fontSize: 'inherit',
											fontWeight: 'inherit',
											position: 'sticky',
											backgroundColor: 'inherit',
											left: 0,
										}}
									>
										Owner
									</TableCell>
									{seasons.map((year) => (
										<TableCell
											align="center"
											key={year}
											sx={{ minWidth: 40, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
										>
											{year}
										</TableCell>
									))}
									{headers.map((h) => (
										<TableCell 
											key={h}
											align="center"
											sx={{
												minWidth: 40,
												fontSize: 'inherit',
												color: 'inherit',
												fontWeight: 'inherit',
												backgroundColor: 'inherit'	
											}}
										>
											{h}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{standingsRows.map((row, idx) => {
									const tmWins = row.seasons.reduce((accu, object) => {
										if (seasons.includes(object.year)) {
											return accu + object.wins;
										} else {
											return accu;
										}
									}, 0).toString();
									const tmLosses = row.seasons.reduce((accu, object) => {
										if (seasons.includes(object.year)) {
											return accu + object.losses;
										} else {
											return accu;
										}
									}, 0).toString();
									const tmTies = row.seasons.reduce((accu, object) => {
										if (seasons.includes(object.year)) {
											return accu + object.ties;
										} else {
											return accu;
										}
									}, 0).toString();
									let tmWinPct;
									if (parseInt(tmWins) + parseInt(tmLosses) === 0) {
										tmWinPct = '';
									} else {
										tmWinPct = (parseInt(tmWins) / (parseInt(tmWins) + parseInt(tmLosses)) * 100).toFixed(2) + '%';
									}

									return (
										<TableRow
											key={row.name}
											sx={{
												backgroundColor: idx % 2 === 0 ? '#5B697F' : '#283447',
												borderColor: idx % 2 === 0 ? '#5B697F' : '#283447',
												color: 'white',
											}}
										>
											<TableCell
												component="th"
												scope="row"
												sx={{
													minWidth: 105,
													fontSize: 'inherit',
													fontWeight: 700,
													position: 'sticky',
													left: 0,
													color: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													border: '2px solid',
												}}
											>
												{row.name}
											</TableCell>
											{seasons.map((s) => {
												const rec = row.seasons.find((r) => r.year === s)
												const borderColor = rec?.reg_season_champ ? 'lightgreen': 'inherit';
												const formattedRecord = rec ? `${rec.wins}-${rec.losses}${rec.ties !== 0 ? '-' + rec.ties : ''}` : '';
												
												return (
													<TableCell
														align="center"
														key={s}
														sx={{
															minWidth: 40,
															fontSize: 'inherit',
															color: rec?.playoff_champ ? 'black' : 'inherit',
															background: rec?.playoff_champ ? 'gold' : 'inherit',
															border: rec?.reg_season_champ ? '2px solid' : '',
															borderColor: borderColor
														}}
													>
														{formattedRecord}
													</TableCell>
													)
												})}
											<TableCell
												align="center"
												sx={{
													minWidth: 40,
													fontSize: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													color: 'inherit',
												}}
											>
												{tmWins}
											</TableCell>
											<TableCell
												align="center"
												sx={{
													minWidth: 40,
													fontSize: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													color: 'inherit',
												}}
											>
												{tmLosses}
											</TableCell>
											<TableCell
												align="center"
												sx={{
													minWidth: 40,
													fontSize: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													color: 'inherit',
												}}
											>
												{tmTies}
											</TableCell>
											<TableCell
												align="center"
												sx={{
													minWidth: 40,
													fontSize: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													color: 'inherit',
												}}
											>
												{tmWinPct}
											</TableCell>
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</TableContainer>
				</div>
			}
			{Object.keys(standingsRows).length > 0 &&
				<div className="legend">
					<div className="legend-champ">League Champ</div>
					<div className="legend-reg-season-champ">Reg Season Champ</div>
				</div>
			}

		</div>
	);
}

export default Standings;
