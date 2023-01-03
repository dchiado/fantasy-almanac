import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";
import './PowerRankings.css';

const PowerRankings = () => {
	const leagueId = useSelector((state) => state.leagueInfo.id)

	const [loading, setLoading] = useState(true);
	const [rankingsData, setRankingsData] = useState([]);
	const [parsedRankings, setParsedRankings] = useState([]);
	const [weights, setWeights] = useState({
		wins: 3,
		overallWins: 1,
		points: 2,
		lastFive: 1,
		consistency: 1,
})

	const columns = ['#', 'Team', 'PR Score', 'Wins', 'Overall Wins', 'Points', 'Consistency', 'Last 5 Wins']

	useEffect(() => {
		if (rankingsData.length === 0 && leagueId) {
			fetch(`${process.env.REACT_APP_API_URL}/power-rankings?leagueId=${leagueId}`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			).then((res) => {
					res.json().then((data) => {
						setRankingsData(data);
						setLoading(false);
					})}
				);
		}
	}, [rankingsData, leagueId]);

	useEffect(() => {
		if (rankingsData.length !== 0) {
			const weightsSum = Object.values(weights).reduce((accu, val) => {
				return accu + (val === '' ? 0 : val);
			}, 0);

			const allWins = rankingsData.map((t) => t.wins).sort((a, b) => b - a);
			const allOverallWins = rankingsData.map((t) => t.overall_wins).sort((a, b) => b - a);
			const allPoints = rankingsData.map((t) => t.points).sort((a, b) => b - a);
			const allLastFive = rankingsData.map((t) => t.l5).sort((a, b) => b - a);
			const allConsistency = rankingsData.map((t) => t.consistency).sort((a, b) => a - b);

			const newRankings = [];
			rankingsData.forEach((tm) => {
				const winsRank = allWins.indexOf(tm.wins) + 1;
				const overallWinsRank = allOverallWins.indexOf(tm.overall_wins) + 1;
				const pointsRank = allPoints.indexOf(tm.points) + 1;
				const lastFiveRank = allLastFive.indexOf(tm.l5) + 1;
				const consistencyRank = allConsistency.indexOf(tm.consistency) + 1;

				const score = (
					(
						(weights.wins * winsRank) +
						(weights.overallWins * overallWinsRank) +
						(weights.points * pointsRank) +
						(weights.lastFive * lastFiveRank) +
						(weights.consistency * consistencyRank)
					) / weightsSum
				).toFixed(2);

				const teamObj = {
					power_ranking_score: score,
					...tm
				}
				newRankings.push(teamObj);
			});

			const sortedData = newRankings.sort((a, b) => a.power_ranking_score - b.power_ranking_score);
			setParsedRankings(sortedData);
		}
	}, [rankingsData, weights])

	const handleChangeWins = (event) => {
		const newVal = parseInt(event.target.value) || 0;
		setWeights(prevState => {
			return { ...prevState, wins: newVal };
		}
	)}

	const handleChangeOverallWins = (event) => {
		const newVal = parseInt(event.target.value) || 0;
		setWeights(prevState => {
			return { ...prevState, overallWins: newVal };
		}
	)}

	const handleChangePoints = (event) => {
		const newVal = parseInt(event.target.value) || 0;
		setWeights(prevState => {
			return { ...prevState, points: newVal };
		}
	)}

	const handleChangeLast5 = (event) => {
		const newVal = parseInt(event.target.value) || 0;
		setWeights(prevState => {
			return { ...prevState, lastFive: newVal };
		}
	)}

	const handleChangeConsistency = (event) => {
		const newVal = parseInt(event.target.value) || 0;
		setWeights(prevState => {
			return { ...prevState, consistency: newVal };
		}
	)}

	return (
		<div className="content">
			{loading && <LoadingSpinner />}
			{parsedRankings.length > 0 &&
				<div className="rankings-container">
					<Typography
						variant="h6"
						sx={{
							display: 'flex',
							fontWeight: 700,
							letterSpacing: '.25rem',
							mb: 2
						}}
						>
						Power Rankings
					</Typography>
					<TableContainer component={Paper} className="table-container" sx={{ borderRadius: 3, mb: '15px' }}>
						<Table sx={{ width: '100%', fontSize: 14 }} size="small" aria-label="standings table">
							<TableHead>
								<TableRow className="table-header">
									{columns.map((c) => (
										<TableCell
											align="center"
											key={c}
											sx={{ minWidth: 40, fontSize: 'inherit', fontWeight: 'inherit' }}
										>
											{c}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{parsedRankings.map((team, idx) => {
									return (
										<TableRow
										key={team.name}
										sx={{
											backgroundColor: idx % 2 === 0 ? '#5B697F' : '#283447',
											borderColor: idx % 2 === 0 ? '#5B697F' : '#283447',
											color: 'white',
										}}
										>
											<TableCell
												align="center"
												component="th"
												scope="row"
												sx={{
													minWidth: 10,
													fontSize: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													color: 'inherit',
												}}
											>
												{idx + 1}
											</TableCell>
											<TableCell
												component="th"
												scope="row"
												sx={{
													minWidth: 40,
													fontSize: 'inherit',
													backgroundColor: 'inherit',
													borderColor: 'inherit',
													color: 'inherit',
													left: 0,
												}}
											>
												{team.name}
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
												{team.power_ranking_score}
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
												{team.wins}
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
												{team.overall_wins}
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
												{team.points}
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
												{team.consistency}
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
												{team.l5}
											</TableCell>
										</TableRow>
									)
								})}
							</TableBody>
						</Table>
					</TableContainer>

					<Typography
						variant="h6"
						sx={{
							display: 'flex',
							fontWeight: 700,
							letterSpacing: '.25rem',
							mb: 2
						}}
						>
						Weights
					</Typography>
					<div className="weights">
						<TextField
							id="weights-wins"
							label="Wins"
							value={weights.wins}
							variant="filled"
							onChange={handleChangeWins}
							sx={{
								input: { color: 'white' },
								label: { color: 'white' },
								maxWidth: 120
							}}
						/>
						<TextField
							id="weights-overall-wins"
							label="Overall Wins"
							value={weights.overallWins}
							variant="filled"
							onChange={handleChangeOverallWins}
							sx={{
								input: { color: 'white' },
								label: { color: 'white' },
								maxWidth: 120
							}}
						/>
						<TextField
							id="weights-points"
							label="Points"
							value={weights.points}
							variant="filled"
							onChange={handleChangePoints}
							sx={{
								input: { color: 'white' },
								label: { color: 'white' },
								maxWidth: 120
							}}
						/>
						<TextField
							id="weights-consistency"
							label="Consistency"
							value={weights.consistency}
							variant="filled"
							onChange={handleChangeConsistency}
							sx={{
								input: { color: 'white' },
								label: { color: 'white' },
								maxWidth: 120
							}}
						/>
						<TextField
							id="weights-last-five"
							label="Last Five"
							value={weights.lastFive}
							variant="filled"
							onChange={handleChangeLast5}
							sx={{
								input: { color: 'white' },
								label: { color: 'white' },
								maxWidth: 120
							}}
						/>
					</div>
				</div>
			}
		</div>
	);
}

export default PowerRankings;
