// The parts of a season report (GET /season, engine/report.py) that the season
// pages are built from: the past-season recap shows them all, and the current
// season splits them across Playoff race and Standings.
import React, { useEffect, useMemo, useState } from "react";
import { Box, ButtonBase, IconButton, Paper, Typography } from "@mui/material";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import useApi from "../../hooks/useApi";
import SectionCard from "../ui/SectionCard";
import StatTable from "../ui/StatTable";
import OddsChart from "./OddsChart";
import PlayoffPicture from "./PlayoffPicture";
import { formatPct, formatRecord, formatSigned } from "./format";

// The report for one season, with team id -> name and abbreviation lookups
export const useSeasonReport = (leagueId, year, setError) => {
  const { data: report, loading, error } = useApi(leagueId && year ? `/season?leagueId=${leagueId}&year=${year}` : null);
  useEffect(() => {
    if (error) setError(`Error retrieving data: ${error.message}`);
  }, [error, setError]);

  const names = useMemo(() => Object.fromEntries((report?.teams ?? []).map((t) => [t.team_id, t.name])), [report]);
  const abbrevs = useMemo(() => Object.fromEntries((report?.teams ?? []).map((t) => [t.team_id, t.abbrev])), [report]);
  return { report, loading, names, abbrevs };
};

const games = (n) => (n === 1 ? 'a game' : n === 0.5 ? 'half a game' : `${n} games`);

// One card per highlight in the report: collapse, comeback, bubble
const highlightText = (h, names, seedingRule) => {
  switch (h.type) {
    case 'collapse':
      return { title: 'Biggest collapse', name: names[h.team_id], body: `Peaked at ${formatPct(h.pct)} in week ${h.week}, missed the playoffs` };
    case 'comeback':
      return { title: 'Biggest comeback', name: names[h.team_id], body: `Down to ${formatPct(h.pct)} in week ${h.week}, made the playoffs` };
    case 'bubble': {
      const how = h.games_ahead > 0 ? `by ${games(h.games_ahead)}`
        : h.games_ahead < 0 ? 'as a division winner'
        : seedingRule === 'TOTAL_POINTS_SCORED' ? `with the same record, by ${h.points_ahead.toFixed(1)} points`
        : 'on the tiebreaker';
      return { title: 'The bubble', name: `${names[h.team_id]} over ${names[h.out_team_id]}`, body: `Took the last playoff spot ${how}` };
    }
    default:
      return null;
  }
};

// A swipeable row on phones, so the chart isn't pushed below the fold; a grid from sm up
export const Highlights = ({ report, names }) => {
  const cards = (report.highlights ?? []).map((h) => highlightText(h, names, report.seeding_rule)).filter(Boolean);
  if (cards.length === 0) return null;

  return (
    <Box
      sx={{
        display: { xs: 'flex', sm: 'grid' },
        gridTemplateColumns: { sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
        gap: { xs: 1.5, sm: 2 },
        overflowX: { xs: 'auto', sm: 'visible' },
        scrollSnapType: { xs: 'x mandatory', sm: 'none' },
        mx: { xs: -2, sm: 0 },
        px: { xs: 2, sm: 0 },
        pb: { xs: 0.5, sm: 0 },
        mb: 3,
      }}
    >
      {cards.map((h) => (
        <Paper key={h.title} variant="outlined" sx={{ p: 2, minWidth: 0, flex: { xs: '0 0 78%', sm: 'initial' }, scrollSnapAlign: 'start' }}>
          <Typography variant="overline" component="h3" color="text.secondary">{h.title}</Typography>
          <Typography sx={{ fontWeight: 700 }} noWrap>{h.name}</Typography>
          <Typography variant="body2" color="text.secondary">{h.body}</Typography>
        </Paper>
      ))}
    </Box>
  );
};

export const PlayoffPictureSection = ({ report }) => (
  <SectionCard title={`Playoff picture · week ${report.scenarios.week}`} sx={{ mb: 3 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {report.scenarios.weeks_left === 1 ? 'Last week' : `${report.scenarios.weeks_left} weeks left`} of the regular season.
      Clinched and eliminated are certain; when a spot could come down to total points, it shows as odds instead.
      The line marks the playoff cutoff.
    </Typography>
    <PlayoffPicture report={report} />
  </SectionCard>
);

// Team name that selects the team in the chart when tapped
const TeamButton = ({ team, selected, onSelect }) => (
  <ButtonBase
    onClick={() => onSelect(team.team_id)}
    aria-pressed={selected}
    sx={{ display: 'flex', alignItems: 'center', gap: 1, font: 'inherit', fontWeight: selected ? 700 : 500, textAlign: 'left', borderRadius: 1, py: 0.25, whiteSpace: 'normal' }}
  >
    <Box component="span" sx={{ width: 12, height: 2, borderRadius: 1, flexShrink: 0,
                                 bgcolor: selected ? 'var(--fa-chart-highlight)' : 'var(--fa-chart-context)' }} />
    {team.name}
  </ButtonBase>
);

export const PlayoffOdds = ({ report, names }) => {
  const weeks = report.playoff_odds.weeks;
  const lastWeek = weeks[weeks.length - 1].week;
  const finalWeek = report.regular_season_weeks;
  const [week, setWeek] = useState(lastWeek);
  useEffect(() => setWeek(lastWeek), [lastWeek]);

  // Highlight the champion once there is one, otherwise the top seed
  const defaultTeam = (report.teams.find((t) => t.final_rank === 1) ?? report.teams[0])?.team_id;
  const [selected, setSelected] = useState(defaultTeam);
  useEffect(() => setSelected(defaultTeam), [defaultTeam]);

  const current = weeks.find((w) => w.week === week) ?? weeks[weeks.length - 1];
  const previous = weeks.find((w) => w.week === week - 1);
  const certain = week === finalWeek;
  const hasDivisions = report.divisions.length > 1;

  // Lowest and highest odds from week 1 through the week shown. Not before week 1
  // (everyone starts about even) or in the last week (it settles everything).
  const range = (teamId) => {
    const seen = weeks.filter((w) => w.week >= 1 && w.week <= week && w.week < finalWeek)
      .map((w) => w.teams.find((t) => t.team_id === teamId).playoff_pct);
    return seen.length ? [Math.min(...seen), Math.max(...seen)] : [null, null];
  };

  const rows = current.teams
    .map((t) => {
      const [low, high] = range(t.team_id);
      const before = previous?.teams.find((p) => p.team_id === t.team_id).playoff_pct;
      return { ...t, name: names[t.team_id], low, high, change: before === undefined ? undefined : t.playoff_pct - before };
    })
    .sort((a, b) => b.playoff_pct - a.playoff_pct || b.avg_wins - a.avg_wins);

  const pct = (p) => (p === null ? '–' : formatPct(p));
  const columns = [
    { key: 'name', label: 'Team', sticky: true, minWidth: 110, wrap: true,
      render: (row) => <TeamButton team={row} selected={row.team_id === selected} onSelect={setSelected} /> },
    { key: 'playoff_pct', label: 'Odds', numeric: true, render: (row) => formatPct(row.playoff_pct, certain), cellSx: () => ({ fontWeight: 600 }) },
    { key: 'low', label: 'Low', numeric: true, render: (row) => pct(row.low), cellSx: () => ({ color: 'text.secondary' }) },
    { key: 'high', label: 'High', numeric: true, render: (row) => pct(row.high), cellSx: () => ({ color: 'text.secondary' }) },
    { key: 'change', label: 'Change', numeric: true, hideBelow: 'sm',
      render: (row) => (row.change === undefined || Math.abs(row.change) < 0.005 ? '–' : formatSigned(row.change * 100, 0)),
      cellSx: () => ({ color: 'text.secondary' }) },
    ...(hasDivisions ? [{ key: 'division_pct', label: 'Division', numeric: true, hideBelow: 'sm', render: (row) => formatPct(row.division_pct, certain) }] : []),
    { key: 'avg_wins', label: 'Proj. wins', numeric: true, hideBelow: 'md', render: (row) => row.avg_wins.toFixed(1) },
  ];

  return (
    <SectionCard title="Playoff odds by week" sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Simulated {report.final ? 'week by week, using only the games played so far each week' : 'from the games played so far'}.
        Low and high are each team's range from week 1 to the week shown, not counting the last week, which settles everything.
        Tap a team to highlight it, or the chart to pick a week.
      </Typography>
      <Highlights report={report} names={names} />
      <OddsChart weeks={weeks} names={names} selected={selected} week={week} onWeekChange={setWeek} finalWeek={finalWeek} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" component="h3">
          {week === 0 ? 'Before week 1' : `After week ${week}`}
        </Typography>
        <Box>
          <IconButton size="small" aria-label="Previous week" disabled={week === 0} onClick={() => setWeek(week - 1)}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton size="small" aria-label="Next week" disabled={week === lastWeek} onClick={() => setWeek(week + 1)}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>
      <StatTable dense columns={columns} rows={rows} getRowKey={(row) => row.team_id}
                 ariaLabel={week === 0 ? 'Playoff odds before week 1' : `Playoff odds after week ${week}`} />
    </SectionCard>
  );
};

// Odds, or why a league doesn't get them
export const PlayoffOddsOrReason = ({ report, names }) => (
  report.playoff_odds
    ? <PlayoffOdds report={report} names={names} />
    : <SectionCard title="Playoff odds by week" sx={{ mb: 3 }}>
        <Typography color="text.secondary">
          Playoff odds aren't available for this season: it breaks ties with a rule the Almanac
          doesn't support yet ({report.unsupported_seeding_rule}).
        </Typography>
      </SectionCard>
);

// Standings in seed order, with what ESPN doesn't show next to the record:
// playoff odds, all-play record, expected wins, luck and close games
export const StandingsTable = ({ report, names }) => {
  const luck = Object.fromEntries(report.luck.map((t) => [t.team_id, t]));
  const latest = report.playoff_odds?.weeks[report.playoff_odds.weeks.length - 1];
  const odds = Object.fromEntries((latest?.teams ?? []).map((t) => [t.team_id, t.playoff_pct]));
  // Once the regular season is over, odds are just who made it
  const showOdds = latest && report.completed_weeks < report.regular_season_weeks;
  const rows = report.teams.map((t) => ({ ...luck[t.team_id], ...t, name: names[t.team_id] }));

  // A heavier line under the last playoff seed
  const cutoffSx = (row, idx) => (idx === report.playoff_team_count - 1 && row.seed ? { borderBottom: '2px solid var(--fa-text-muted)' } : {});
  const withCutoff = (cellSx) => (row, idx) => ({ ...cutoffSx(row, idx), ...(cellSx ? cellSx(row, idx) : {}) });

  const columns = [
    { key: 'name', label: 'Team', sticky: true, minWidth: 120, wrap: true,
      render: (row) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box component="span" sx={{ color: 'text.secondary', minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{row.seed ?? ''}</Box>
          <span>
            {row.name}
            {/* The Record column is hidden on phones, so show it here */}
            <Box component="span" sx={{ display: { xs: 'block', sm: 'none' }, color: 'text.secondary', fontSize: 12 }}>
              {formatRecord(row)}
            </Box>
          </span>
        </Box>
      ) },
    { key: 'record', label: 'Record', align: 'center', hideBelow: 'sm', render: (row) => formatRecord(row), cellSx: () => ({ fontWeight: 600 }) },
    { key: 'points_for', label: 'PF', numeric: true, hideBelow: 'sm', render: (row) => row.points_for.toFixed(1) },
    { key: 'points_against', label: 'PA', numeric: true, hideBelow: 'md', render: (row) => row.points_against.toFixed(1) },
    ...(showOdds ? [{ key: 'odds', label: 'Odds', numeric: true, hideBelow: 'sm', render: (row) => formatPct(odds[row.team_id]) }] : []),
    { key: 'all_play', label: 'All-play', align: 'center', hideBelow: 'md',
      render: (row) => formatRecord({ wins: row.all_play_wins, losses: row.all_play_losses, ties: row.all_play_ties }) },
    { key: 'expected_wins', label: 'Exp. wins', numeric: true, render: (row) => row.expected_wins.toFixed(1) },
    { key: 'luck', label: 'Luck', numeric: true, render: (row) => formatSigned(row.luck), cellSx: () => ({ fontWeight: 600 }) },
    { key: 'close', label: 'Close', align: 'center', hideBelow: 'sm',
      render: (row) => (row.close_wins + row.close_losses ? `${row.close_wins}-${row.close_losses}` : '–') },
  ].map((col) => ({ ...col, cellSx: withCutoff(col.cellSx) }));

  return (
    <SectionCard title={report.completed_weeks === report.regular_season_weeks ? 'Final standings' : 'Standings'} sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        In seed order, using the league's playoff rules; the line marks the playoff cutoff.
        Expected wins are what each team's scores were worth against the whole league each week (its all-play record),
        and luck is actual wins minus expected. Close games were decided by under 5 points.
      </Typography>
      <StatTable dense columns={columns} rows={rows} getRowKey={(row) => row.team_id} ariaLabel="Standings" />
    </SectionCard>
  );
};

export const ScheduleSwap = ({ report, names, abbrevs }) => {
  const { team_ids: ids, records } = report.schedule_swap;
  const rows = ids.map((id, i) => ({ id, name: names[id], cells: records[i] }));
  const columns = [
    { key: 'name', label: 'Team', sticky: true, minWidth: 130, wrap: true },
    ...ids.map((id, j) => ({
      key: String(id),
      label: abbrevs[id] || names[id],
      align: 'center',
      render: (row) => formatRecord({ wins: row.cells[j][0], losses: row.cells[j][1], ties: row.cells[j][2] }),
      cellSx: (row) => (row.id === id ? { fontWeight: 700, color: 'text.primary' } : { color: 'text.secondary' }),
    })),
  ];

  return (
    <SectionCard title="Schedule swap" sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each row is that team's record if it had played the column team's schedule. Bold is its actual record.
      </Typography>
      <StatTable columns={columns} rows={rows} getRowKey={(row) => row.id} ariaLabel="Schedule swap" />
    </SectionCard>
  );
};
