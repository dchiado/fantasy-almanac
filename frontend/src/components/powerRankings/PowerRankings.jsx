import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Skeleton, Slider, Typography, useMediaQuery } from "@mui/material";
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

// A writeup still being written is asked for again this often, this many times.
// Together they outlast the writer's 60s timeout.
const RETRY_MS = 8000;
const RETRIES = 8;

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

const WriteupSkeleton = () => (
	<Box aria-label="Writing this week's power rankings">
		{[100, 92, 96, 70, 100, 88, 94, 60].map((width, i) => (
			<Skeleton key={i} variant="text" width={`${width}%`} />
		))}
	</Box>
);

const PowerRankings = ({ setError }) => {
	const leagueId = useSelector((state) => state.leagueInfo.id)
	const isWide = useMediaQuery((theme) => theme.breakpoints.up('lg'));

	const [loading, setLoading] = useState(true);
	const [rankingsData, setRankingsData] = useState([]);
	const [writeup, setWriteup] = useState(null);
	const [writeupStatus, setWriteupStatus] = useState(null);
	const [writeupExpanded, setWriteupExpanded] = useState(false);
	const [writeupOverflows, setWriteupOverflows] = useState(false);
	const writeupRef = useRef(null);
	const [weights, setWeights] = useState(DEFAULT_WEIGHTS);

	useEffect(() => {
		if (rankingsData.length === 0 && leagueId) {
			fetchApi(`/power-rankings?leagueId=${leagueId}`)
			.then((data) => {
				setRankingsData(data.teams);

				setWriteup(data.writeup || null);
				setWriteupStatus(data.writeup_status || null);

				setLoading(false);
			})
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});
		}
	}, [rankingsData, leagueId, setError]);

	// Asks for a pending writeup again, without touching the rankings already showing
	useEffect(() => {
		if (!leagueId || writeupStatus !== 'pending') {
			return undefined;
		}

		let cancelled = false;
		let timer;
		let tries = 0;

		const check = () => {
			tries += 1;
			fetchApi(`/power-rankings?leagueId=${leagueId}`)
				.then((data) => {
					if (cancelled) {
						return;
					}

					if (data.writeup_status !== 'pending') {
						setWriteup(data.writeup || null);
						setWriteupStatus(data.writeup_status || null);
					} else if (tries < RETRIES) {
						timer = setTimeout(check, RETRY_MS);
					} else {
						setWriteupStatus('late');
					}
				})
				.catch(() => {
					if (!cancelled) {
						setWriteupStatus('failed'); // the rankings are already showing; just no writeup
					}
				});
		};
		timer = setTimeout(check, RETRY_MS);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [leagueId, writeupStatus]);

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

	let writeupContent = null;
	if (writeup) {
		writeupContent = (
			<>
				<Box ref={writeupRef} className={`pr-writeup${writeupExpanded ? '' : ' collapsed'}${!writeupExpanded && writeupOverflows ? ' faded' : ''}`}>
					<ReactMarkdown>{writeup}</ReactMarkdown>
				</Box>
				{(writeupOverflows || writeupExpanded) &&
					<Button size="small" onClick={() => setWriteupExpanded((v) => !v)} sx={{ mt: 1, ml: -1 }}>
						{writeupExpanded ? 'Show less' : 'Read the full writeup'}
					</Button>
				}
			</>
		);
	} else if (writeupStatus === 'pending') {
		writeupContent = <WriteupSkeleton />;
	} else if (writeupStatus === 'late') {
		writeupContent = <Typography variant="body2" color="text.secondary">Still being written. Check back in a minute.</Typography>;
	}

	return (
		<PageLayout maxWidth={1300} title="Power Rankings" subtitle="Arrows show movement since last week." nav={<ThisSeasonTabs />}>
			{parsedRankings.length > 0 &&
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3, sm: 4 } }}>
					{/* Only leagues in AI_LEAGUES get a writeup; for the rest, and for failed ones, the card is left out */}
					{writeupContent &&
					<SectionCard title="This week's writeup">
						{writeupContent}
					</SectionCard>
					}

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
