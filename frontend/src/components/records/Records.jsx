import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import StatTable from "../ui/StatTable";
import useApi from "../../hooks/useApi";

const rankColumn = { key: 'rank', label: '#', align: 'center', render: (_, idx) => idx + 1, cellSx: () => ({ color: 'text.secondary', width: 40 }) };

const columnsFor = {
  week: [
    rankColumn,
    { key: 'year', label: 'Year', align: 'center' },
    { key: 'week', label: 'Week', align: 'center' },
    { key: 'team_name', label: 'Team', wrap: true, minWidth: 140 },
    { key: 'score', label: 'Score', numeric: true, cellSx: () => ({ fontWeight: 600 }) },
  ],
  season: [
    rankColumn,
    { key: 'year', label: 'Year', align: 'center' },
    { key: 'team_name', label: 'Team', wrap: true, minWidth: 140 },
    { key: 'average', label: 'Average', numeric: true, cellSx: () => ({ fontWeight: 600 }) },
    { key: 'league_average', label: 'League Avg', numeric: true, hideBelow: 'sm' },
    { key: 'std_dev_away', label: 'Std Dev', numeric: true },
  ],
  matchup: [
    rankColumn,
    { key: 'year', label: 'Year', align: 'center' },
    { key: 'week', label: 'Week', align: 'center' },
    { key: 'difference', label: 'Margin', numeric: true, cellSx: () => ({ fontWeight: 600 }) },
    { key: 'winner', label: 'Winner', wrap: true, minWidth: 120 },
    { key: 'loser', label: 'Loser', wrap: true, minWidth: 120 },
  ],
};

const endpointFor = { week: '/individual-weeks', season: '/individual-seasons', matchup: '/matchups' };
const COUNTS = [5, 10, 25, 50, 100];

// Toggle groups ignore a click on the active option rather than clearing it
const exclusive = (setter) => (_, value) => { if (value !== null) setter(value); };

const Records = ({ setError }) => {
	const leagueInfo = useSelector((state) => state.leagueInfo)
  const leagueId = leagueInfo.id;

  const firstYear = Number(leagueInfo.established) || null;
  const lastYear = Number(leagueInfo.year) || null;
  const years = firstYear && lastYear ? Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i) : [];

  const [bestWorst, setBestWorst] = useState('best');
  const [object, setObject] = useState('week');
  const [scope, setScope] = useState('alltime');
  const [startYear, setStartYear] = useState(firstYear ?? '');
  const [endYear, setEndYear] = useState(lastYear ?? '');
  const [numRecords, setNumRecords] = useState(10);
  const [includePlayoffs, setIncludePlayoffs] = useState(false);

  // League info can land after this page mounts (e.g. a direct visit), so seed the range then
  useEffect(() => {
    if (firstYear && startYear === '') setStartYear(firstYear);
    if (lastYear && endYear === '') setEndYear(lastYear);
  }, [firstYear, lastYear, startYear, endYear]);

  const usesRange = scope === 'years' && startYear !== '' && endYear !== '';
  const params = `?leagueId=${leagueId}&bestworst=${bestWorst}&playoffs=${includePlayoffs}&count=${numRecords}`
    + (usesRange ? `&startyear=${startYear}&endyear=${endYear}` : '');
  const { data: records, loading, error } = useApi(leagueId ? endpointFor[object] + params : null);

  useEffect(() => {
    if (error) setError(`Error retrieving data: ${error.message}`);
  }, [error, setError]);

  const yearSelect = (id, label, value, onChange) => (
    <FormControl sx={{ minWidth: 96, flex: 1 }}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select labelId={`${id}-label`} id={id} value={value} label={label} onChange={(e) => onChange(e.target.value)}>
        {years.map((y) => <MenuItem value={y} key={y}>{y}</MenuItem>)}
      </Select>
    </FormControl>
  );

  const objectLabel = { week: 'weeks', season: 'seasons', matchup: 'matchups' }[object];
  const rangeLabel = usesRange ? `from ${startYear} to ${endYear}` : 'of all time';

  return (
    <PageLayout maxWidth={900} title="Records" subtitle={`The ${numRecords} ${bestWorst} ${objectLabel} ${rangeLabel}`}>
      <SectionCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup exclusive fullWidth size="small" color="primary" value={bestWorst} onChange={exclusive(setBestWorst)} aria-label="Best or worst">
            <ToggleButton value="best">Best</ToggleButton>
            <ToggleButton value="worst">Worst</ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup exclusive fullWidth size="small" color="primary" value={object} onChange={exclusive(setObject)} aria-label="Record type">
            <ToggleButton value="week">Weeks</ToggleButton>
            <ToggleButton value="season">Seasons</ToggleButton>
            <ToggleButton value="matchup">Matchups</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mt: 2 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={scope}
            onChange={exclusive(setScope)}
            aria-label="Time range"
            sx={{ flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
          >
            <ToggleButton value="alltime" sx={{ flex: 1 }}>All-time</ToggleButton>
            <ToggleButton value="years" sx={{ flex: 1 }} disabled={years.length === 0}>Year range</ToggleButton>
          </ToggleButtonGroup>

          {scope === 'years' &&
            <Box sx={{ display: 'flex', gap: 1.5, flex: { xs: '1 1 100%', sm: '0 1 220px' } }}>
              {yearSelect('start-year', 'From', startYear, (y) => { setStartYear(y); if (y > endYear) setEndYear(y); })}
              {yearSelect('end-year', 'To', endYear, (y) => { setEndYear(y); if (y < startYear) setStartYear(y); })}
            </Box>
          }

          <FormControl sx={{ minWidth: 90 }}>
            <InputLabel id="num-records-label">Show</InputLabel>
            <Select labelId="num-records-label" id="num-records" value={numRecords} label="Show" onChange={(e) => setNumRecords(e.target.value)}>
              {COUNTS.map((c) => <MenuItem value={c} key={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          {object !== 'season' &&
            <FormControlLabel
              control={<Switch checked={includePlayoffs} onChange={(e) => setIncludePlayoffs(e.target.checked)} />}
              label="Include playoffs"
            />
          }
        </Box>
      </SectionCard>

      {loading
        ? <LoadingState inline rows={Math.min(numRecords, 12)} title={false} />
        : records?.length > 0
          ? <StatTable columns={columnsFor[object]} rows={records} ariaLabel="Records" />
          : Array.isArray(records) && <Typography color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>No records match those filters.</Typography>
      }
    </PageLayout>
  )
}

export default Records;
