import React, { useEffect, useMemo, useState } from "react";
import { Box, ButtonBase, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Typography } from "@mui/material";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSelector } from "react-redux";
import { useHistory, useParams } from "react-router-dom";
import useApi from "../../hooks/useApi";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import StatTable from "../ui/StatTable";
import OddsChart from "./OddsChart";
import { formatPct, formatRecord, formatSigned } from "./format";

const weekLabel = (week) => (week === 0 ? 'Preseason' : `Week ${week}`);

// One card per highlight the backend found (engine/simulation.py `highlights`)
const highlightText = (h, names, finalWeek) => {
  const name = names[h.team_id];
  const pct = (p, week) => formatPct(p, week === finalWeek);
  switch (h.type) {
    case 'riser':
      return { title: 'Biggest jump', name, body: `${pct(h.from, h.week - 1)} → ${pct(h.to, h.week)} in week ${h.week}` };
    case 'faller':
      return { title: 'Biggest drop', name, body: `${pct(h.from, h.week - 1)} → ${pct(h.to, h.week)} in week ${h.week}` };
    case 'collapse':
      return { title: 'Biggest collapse', name, body: `Peaked at ${pct(h.pct, h.week)} (${weekLabel(h.week).toLowerCase()}), missed the playoffs` };
    case 'comeback':
      return { title: 'Biggest comeback', name, body: `Down to ${pct(h.pct, h.week)} (${weekLabel(h.week).toLowerCase()}), made the playoffs` };
    case 'biggest_game':
      return {
        title: 'Biggest game',
        name: `${names[h.home]} vs ${names[h.away]}`,
        body: `Week ${h.week}: ${h.home_points.toFixed(1)}–${h.away_points.toFixed(1)}, moved their odds ${Math.round(h.swing * 100)} points combined`,
      };
    default:
      return null;
  }
};

// A swipeable row on phones, so the chart isn't pushed below the fold; a grid from sm up
const Highlights = ({ highlights, names, finalWeek }) => (
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
    {highlights.map((h) => highlightText(h, names, finalWeek)).filter(Boolean).map((h) => (
      <Paper key={h.title} variant="outlined" sx={{ p: 2, minWidth: 0, flex: { xs: '0 0 78%', sm: 'initial' }, scrollSnapAlign: 'start' }}>
        <Typography variant="overline" component="h3" color="text.secondary">{h.title}</Typography>
        <Typography sx={{ fontWeight: 700 }} noWrap>{h.name}</Typography>
        <Typography variant="body2" color="text.secondary">{h.body}</Typography>
      </Paper>
    ))}
  </Box>
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

const PlayoffOdds = ({ report, names, selected, onSelect }) => {
  const odds = report.playoff_odds;
  const weeks = odds.weeks;
  const lastWeek = weeks[weeks.length - 1].week;
  const finalWeek = report.regular_season_weeks;
  const [week, setWeek] = useState(lastWeek);
  useEffect(() => setWeek(lastWeek), [lastWeek]);

  const current = weeks.find((w) => w.week === week) ?? weeks[weeks.length - 1];
  const previous = weeks.find((w) => w.week === week - 1);
  const certain = week === finalWeek;
  const hasDivisions = report.divisions.length > 1;

  const rows = current.teams
    .map((t) => ({ ...t, name: names[t.team_id], change: previous && t.playoff_pct - previous.teams.find((p) => p.team_id === t.team_id).playoff_pct }))
    .sort((a, b) => b.playoff_pct - a.playoff_pct || b.avg_wins - a.avg_wins);

  const columns = [
    { key: 'name', label: 'Team', sticky: true, minWidth: 130, wrap: true,
      render: (row) => <TeamButton team={row} selected={row.team_id === selected} onSelect={onSelect} /> },
    { key: 'playoff_pct', label: 'Playoffs', numeric: true, render: (row) => formatPct(row.playoff_pct, certain), cellSx: () => ({ fontWeight: 600 }) },
    { key: 'change', label: 'Change', numeric: true, hideBelow: 'sm',
      render: (row) => (row.change === undefined || Math.abs(row.change) < 0.005 ? '–' : formatSigned(row.change * 100, 0)),
      cellSx: () => ({ color: 'text.secondary' }) },
    ...(hasDivisions ? [{ key: 'division_pct', label: 'Division', numeric: true, hideBelow: 'sm', render: (row) => formatPct(row.division_pct, certain) }] : []),
    { key: 'avg_wins', label: 'Proj. wins', numeric: true, hideBelow: 'sm', render: (row) => row.avg_wins.toFixed(1) },
  ];

  return (
    <SectionCard title="Playoff odds by week" sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Simulated {report.final ? 'week by week, using only the games played so far each week' : 'from the games played so far'}.
        Tap a team to highlight it, or the chart to pick a week.
      </Typography>
      {odds.highlights.length > 0 && <Highlights highlights={odds.highlights} names={names} finalWeek={finalWeek} />}
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
      <StatTable columns={columns} rows={rows} getRowKey={(row) => row.team_id} ariaLabel={`Playoff odds after ${weekLabel(week).toLowerCase()}`} />
    </SectionCard>
  );
};

const Luck = ({ report, names }) => {
  const rows = report.luck.map((t) => ({ ...t, name: names[t.team_id] }));
  const columns = [
    { key: 'name', label: 'Team', sticky: true, minWidth: 120, wrap: true,
      render: (row) => (
        <>
          {row.name}
          {/* The Record column is hidden on phones, so show it here */}
          <Box component="span" sx={{ display: { xs: 'block', sm: 'none' }, color: 'text.secondary', fontSize: 12 }}>
            {formatRecord(row)}
          </Box>
        </>
      ) },
    { key: 'record', label: 'Record', align: 'center', hideBelow: 'sm', render: (row) => formatRecord(row) },
    { key: 'all_play', label: 'All-play', align: 'center', hideBelow: 'sm',
      render: (row) => formatRecord({ wins: row.all_play_wins, losses: row.all_play_losses, ties: row.all_play_ties }) },
    { key: 'expected_wins', label: 'Exp. wins', numeric: true, render: (row) => row.expected_wins.toFixed(1) },
    { key: 'luck', label: 'Luck', numeric: true, render: (row) => formatSigned(row.luck), cellSx: () => ({ fontWeight: 600 }) },
    { key: 'close', label: 'Close games', align: 'center', hideBelow: 'sm',
      render: (row) => (row.close_wins + row.close_losses ? `${row.close_wins}-${row.close_losses}` : '–') },
  ];

  return (
    <SectionCard title="Luck" sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Expected wins are what each team's scores were worth against the whole league each week (its all-play record).
        Luck is actual wins minus expected wins. Close games were decided by under 5 points.
      </Typography>
      <StatTable columns={columns} rows={rows} getRowKey={(row) => row.team_id} ariaLabel="Luck" />
    </SectionCard>
  );
};

const ScheduleSwap = ({ report, names, abbrevs }) => {
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

const SeasonPage = ({ setError }) => {
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const { year: yearParam } = useParams();
  const history = useHistory();

  const path = leagueInfo.id ? `/season?leagueId=${leagueInfo.id}${yearParam ? `&year=${yearParam}` : ''}` : null;
  const { data: report, loading, error } = useApi(path);

  useEffect(() => {
    if (error) setError(`Error retrieving data: ${error.message}`);
  }, [error, setError]);

  const names = useMemo(() => Object.fromEntries((report?.teams ?? []).map((t) => [t.team_id, t.name])), [report]);
  const abbrevs = useMemo(() => Object.fromEntries((report?.teams ?? []).map((t) => [t.team_id, t.abbrev])), [report]);

  // Highlight the champion once there is one, otherwise the top seed
  const defaultTeam = useMemo(() => {
    const teams = report?.teams ?? [];
    return (teams.find((t) => t.final_rank === 1) ?? teams[0])?.team_id ?? null;
  }, [report]);
  const [selected, setSelected] = useState(null);
  useEffect(() => setSelected(defaultTeam), [defaultTeam]);

  const firstYear = Number(leagueInfo.established) || null;
  const lastYear = Number(leagueInfo.year) || null;
  const years = firstYear && lastYear ? Array.from({ length: lastYear - firstYear + 1 }, (_, i) => lastYear - i) : [];
  const shownYear = report?.year ?? (yearParam ? Number(yearParam) : '');

  const picker = years.length > 0 && (
    <FormControl sx={{ minWidth: 120 }}>
      <InputLabel id="season-year-label">Season</InputLabel>
      <Select
        labelId="season-year-label"
        id="season-year"
        label="Season"
        value={years.includes(shownYear) ? shownYear : ''}
        onChange={(e) => history.push(`/seasons/${e.target.value}`)}
      >
        {years.map((y) => <MenuItem value={y} key={y}>{y}</MenuItem>)}
      </Select>
    </FormControl>
  );

  const subtitle = report && (report.final
    ? `Final · ${report.teams.length} teams · ${report.playoff_team_count} made the playoffs`
    : report.completed_weeks === 0
      ? 'No games played yet'
      : `Through week ${report.completed_weeks} of ${report.regular_season_weeks}`);

  return (
    <PageLayout maxWidth={1000} title={shownYear ? `${shownYear} season` : 'Season'} subtitle={subtitle} actions={picker}>
      {loading || !report
        ? <LoadingState inline rows={12} title={false} />
        : <>
            {report.playoff_odds
              ? <PlayoffOdds report={report} names={names} selected={selected} onSelect={setSelected} />
              : <SectionCard title="Playoff odds by week" sx={{ mb: 3 }}>
                  <Typography color="text.secondary">
                    Playoff odds aren't available for this season: it breaks ties with a rule the Almanac
                    doesn't support yet ({report.unsupported_seeding_rule}).
                  </Typography>
                </SectionCard>
            }
            {report.completed_weeks > 0 && <Luck report={report} names={names} />}
            {report.completed_weeks > 0 && <ScheduleSwap report={report} names={names} abbrevs={abbrevs} />}
          </>
      }
    </PageLayout>
  );
};

export default SeasonPage;
