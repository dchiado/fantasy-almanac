import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Slider, Typography, useMediaQuery } from "@mui/material";
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import ReactMarkdown from 'react-markdown';
import LoadingState from "../ui/LoadingState";
import MovementBadge from "../ui/MovementBadge";
import PageLayout from "../ui/PageLayout";
import ThisSeasonTabs from "../season/ThisSeasonTabs";
import SectionCard from "../ui/SectionCard";
import StatTable from "../ui/StatTable";
import { DEFAULT_WEIGHTS, rankWithMovement } from "../../utils/powerRankings";
import './PowerRankings.css';
import { fetchApi } from "../../api";

const columns = [
	{
		key: 'name',
		label: 'Team',
		sticky: true,
		minWidth: 170,
		render: (team, idx) => (
			<Box component="span" sx={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
				<Box component="span" sx={{ color: 'text.secondary', width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</Box>
				<MovementBadge movement={team.movement} />
				<Box component="span" sx={{ fontWeight: 600 }}>{team.name}</Box>
			</Box>
		),
	},
	{ key: 'power_ranking_score', label: 'PR Score', numeric: true, cellSx: () => ({ fontWeight: 700, color: 'primary.main' }) },
	{ key: 'wins', label: 'Wins', numeric: true },
	{ key: 'overall_wins', label: 'Overall Wins', numeric: true },
	{ key: 'points', label: 'Points', numeric: true },
	{ key: 'consistency', label: 'Consistency', numeric: true },
	{ key: 'l5', label: 'Last 5', numeric: true },
];

const weightFields = [
	{ key: 'wins', label: 'Wins' },
	{ key: 'overallWins', label: 'Overall wins' },
	{ key: 'points', label: 'Points' },
	{ key: 'consistency', label: 'Consistency' },
	{ key: 'lastFive', label: 'Last five' },
];

const PowerRankings = ({ setError }) => {
	const leagueId = useSelector((state) => state.leagueInfo.id)
	const isWide = useMediaQuery((theme) => theme.breakpoints.up('lg'));

	const [loading, setLoading] = useState(true);
	const [rankingsData, setRankingsData] = useState([]);
	const [writeup, setWriteup] = useState(null);
	const [writeupExpanded, setWriteupExpanded] = useState(false);
	const [writeupOverflows, setWriteupOverflows] = useState(false);
	const writeupRef = useRef(null);
	const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

	useEffect(() => {
		if (rankingsData.length === 0 && leagueId) {
			fetchApi(`/power-rankings?leagueId=${leagueId}`)
			.then((data) => {
				setRankingsData(data.teams);

				if (data.writeup) {
					setWriteup(data.writeup);
				}

				setLoading(false);
			})
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});
		}
	}, [rankingsData, leagueId, setError]);

	// Only offer "read more" when the collapsed writeup actually cuts text off
	useLayoutEffect(() => {
		const el = writeupRef.current;
		if (el && !writeupExpanded) setWriteupOverflows(el.scrollHeight > el.clientHeight + 1);
	}, [writeup, writeupExpanded, loading]);

	const parsedRankings = useMemo(
		() => rankingsData.length ? rankWithMovement(rankingsData, weights) : [],
		[rankingsData, weights]
	);

	const weightsChanged = weightFields.some(({ key }) => weights[key] !== DEFAULT_WEIGHTS[key]);

	const weightControls = (
		<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
			{weightFields.map(({ key, label }) => (
				<Box key={key}>
					<Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
						<Typography variant="body2" id={`weight-${key}-label`}>{label}</Typography>
						<Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{weights[key]}</Typography>
					</Box>
					<Slider
						aria-labelledby={`weight-${key}-label`}
						value={weights[key]}
						onChange={(_, val) => setWeights((prev) => ({ ...prev, [key]: val }))}
						min={0}
						max={5}
						step={1}
						marks
						size="small"
					/>
				</Box>
			))}
			<Button size="small" onClick={() => setWeights(DEFAULT_WEIGHTS)} disabled={!weightsChanged} sx={{ alignSelf: 'flex-start' }}>
				Reset to defaults
			</Button>
		</Box>
	);

	if (loading) {
		return <LoadingState rows={12} />;
	}

	return (
		<PageLayout maxWidth={1300} title="Power Rankings" subtitle="Arrows show movement since last week." nav={<ThisSeasonTabs />}>
			{parsedRankings.length > 0 &&
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, sm: 4 } }}>
					<SectionCard title="This week's writeup">
						{writeup
							? <>
									<Box ref={writeupRef} className={`pr-writeup${writeupExpanded ? '' : ' collapsed'}${!writeupExpanded && writeupOverflows ? ' faded' : ''}`}>
										<ReactMarkdown>{writeup}</ReactMarkdown>
									</Box>
									{(writeupOverflows || writeupExpanded) &&
										<Button size="small" onClick={() => setWriteupExpanded((v) => !v)} sx={{ mt: 1, ml: -1 }}>
											{writeupExpanded ? 'Show less' : 'Read the full writeup'}
										</Button>
									}
								</>
							: <Typography color="text.secondary">Check back later for the power rankings writeup.</Typography>
						}
					</SectionCard>

					<Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 260px' }, gap: 3, alignItems: 'start' }}>
						<Box>
							<Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>Breakdown</Typography>
							<StatTable
								columns={columns}
								rows={parsedRankings}
								getRowKey={(team) => team.name}
								ariaLabel="Power rankings breakdown"
							/>
						</Box>

						{/* Beside the table on wide screens so changes are visible while tuning; collapsed below it elsewhere */}
						{isWide
							? <SectionCard title="Weights" sx={{ position: 'sticky', top: 88, mt: 5 }}>{weightControls}</SectionCard>
							: <Accordion variant="outlined" disableGutters sx={{ borderRadius: 3, '&:before': { display: 'none' } }}>
									<AccordionSummary expandIcon={<ExpandMoreIcon />}>
										<Typography sx={{ fontWeight: 600 }}>Tune the weights</Typography>
										{weightsChanged && <Typography variant="body2" color="primary.main" sx={{ ml: 1 }}>· customized</Typography>}
									</AccordionSummary>
									<AccordionDetails>{weightControls}</AccordionDetails>
								</Accordion>
						}
					</Box>
				</Box>
			}
		</PageLayout>
	);
}

export default PowerRankings;
