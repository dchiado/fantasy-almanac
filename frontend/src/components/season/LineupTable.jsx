// Points left on the bench over the regular season (GET /lineups,
// engine/lineups.py), with the games each team's best lineup would have won
import React from "react";
import { Box, Typography } from "@mui/material";
import useApi from "../../hooks/useApi";
import LoadingState from "../ui/LoadingState";
import SectionCard from "../ui/SectionCard";
import StatTable from "../ui/StatTable";
import { formatRecord } from "./format";

const LineupTable = ({ leagueId, year, names }) => {
  const { data, loading, error } = useApi(leagueId && year ? `/lineups?leagueId=${leagueId}&year=${year}` : null);

  // The rest of the page still works without it
  if (error) {
    return null;
  }

  if (loading || !data) {
    return <LoadingState inline rows={6} title={false} />;
  }

  if (data.weeks === 0) {
    return null;
  }

  const rows = data.teams.map((t) => ({ ...t, name: names[t.team_id] }));
  const columns = [
    { key: 'name', label: 'Team', sticky: true, minWidth: 120, wrap: true,
      render: (row) => (
        <span>
          {row.name}
          {/* The Record column is hidden on phones, so show it here */}
          <Box component="span" sx={{ display: { xs: 'block', sm: 'none' }, color: 'text.secondary', fontSize: 12 }}>
            {formatRecord(row.record)}
          </Box>
        </span>
      ) },
    { key: 'left', label: 'Left on bench', numeric: true, render: (row) => row.left.toFixed(1), cellSx: () => ({ fontWeight: 600 }) },
    { key: 'per_week', label: 'Per week', numeric: true, hideBelow: 'md', render: (row) => (row.left / data.weeks).toFixed(1) },
    { key: 'worst_week', label: 'Worst week', align: 'center', hideBelow: 'md',
      render: (row) => (row.worst_week?.left > 0 ? `${row.worst_week.left.toFixed(1)} (wk ${row.worst_week.week})` : '–') },
    { key: 'blunders', label: 'Cost a win', align: 'center', render: (row) => row.blunders || '–' },
    { key: 'record', label: 'Record', align: 'center', hideBelow: 'sm', render: (row) => formatRecord(row.record) },
    { key: 'best_record', label: 'Best lineups', align: 'center', render: (row) => formatRecord(row.best_record) },
  ];

  return (
    <SectionCard title="Points left on the bench" sx={{ mb: 3 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each week's best possible lineup against the one each team started, over the regular season.
        A game cost a win when the best lineup would have beaten the opponent's actual score; the last
        column is the head-to-head record with those games as wins.
      </Typography>
      <StatTable dense columns={columns} rows={rows} getRowKey={(row) => row.team_id} ariaLabel="Points left on the bench" />
    </SectionCard>
  );
};

export default LineupTable;
