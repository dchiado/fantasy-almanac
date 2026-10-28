import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import { STATUS_LABELS, conditionText, formatPct, formatRecord, spots } from "./format";

const statusChipProps = {
  clinched: { color: 'success' },
  eliminated: { sx: { color: 'text.disabled', borderColor: 'var(--fa-border)' } },
  win_out: { color: 'primary' },
  needs_help: {},
};

/**
 * The stretch-run playoff picture: every team in seed order with its status,
 * this week's clinch and elimination conditions, and its playoff odds.
 * Pass `limit` to show only the top teams (the Home card).
 */
const PlayoffPicture = ({ report, limit }) => {
  const scenarios = report.scenarios;
  const byTeam = Object.fromEntries(scenarios.teams.map((t) => [t.team_id, t]));
  const names = Object.fromEntries(report.teams.map((t) => [t.team_id, t.name]));
  const latestOdds = report.playoff_odds?.weeks[report.playoff_odds.weeks.length - 1];
  const odds = Object.fromEntries((latestOdds?.teams ?? []).map((t) => [t.team_id, t.playoff_pct]));
  const teams = limit ? report.teams.slice(0, limit) : report.teams;

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {teams.map((team, idx) => {
        const scenario = byTeam[team.team_id];
        const lines = [
          conditionText(scenario.clinch, 'Clinches', team.team_id, names),
          conditionText(scenario.eliminate, 'Eliminated', team.team_id, names),
        ].filter(Boolean);
        const cutoff = idx === spots(report) - 1 && !limit;

        return (
          <Box
            component="li"
            key={team.team_id}
            sx={{
              display: 'grid',
              gridTemplateColumns: '24px minmax(0, 1fr) 48px',
              columnGap: 1.5,
              alignItems: 'start',
              py: 1.25,
              borderBottom: cutoff ? '2px solid var(--fa-text-muted)' : '1px solid var(--fa-border)',
              '&:last-of-type': { borderBottom: 0 },
            }}
          >
            <Typography sx={{ textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {team.seed ?? idx + 1}
            </Typography>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600 }} noWrap>{team.name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                <Typography variant="body2" color="text.secondary">{formatRecord(team)}</Typography>
                <Chip size="small" variant="outlined" label={STATUS_LABELS[scenario.status]}
                      sx={{ height: 20, fontSize: 12, ...statusChipProps[scenario.status].sx }}
                      color={statusChipProps[scenario.status].color} />
              </Box>
            </Box>
            <Typography sx={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {team.team_id in odds ? formatPct(odds[team.team_id]) : ''}
            </Typography>
            {lines.length > 0 &&
              <Box sx={{ gridColumn: '2 / -1', mt: 0.5 }}>
                {lines.map((line) => <Typography key={line} variant="body2" color="text.secondary">{line}</Typography>)}
              </Box>
            }
          </Box>
        );
      })}
    </Box>
  );
};

export default PlayoffPicture;
