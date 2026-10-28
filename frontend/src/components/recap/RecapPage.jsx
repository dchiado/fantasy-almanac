import React, { useMemo } from "react";
import { Box, Button, FormControl, Link as MuiLink, MenuItem, Paper, Select, Typography } from "@mui/material";
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSelector } from "react-redux";
import { Link, useHistory, useParams } from "react-router-dom";
import useApi from "../../hooks/useApi";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import { currentSeason, recapPath } from "../../utils/seasons";
import { gameOfTheWeek, recapItems } from "./recapItems";

export const RecapItemCard = ({ item }) => (
  <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
    <Typography variant="overline" component="h3" color="text.secondary">{item.title}</Typography>
    <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{item.name}</Typography>
    {item.detail && <Typography variant="body2" color="text.secondary">{item.detail}</Typography>}
    {item.badge &&
      <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600, color: 'primary.main' }}>{item.badge}</Typography>
    }
  </Paper>
);

// "Playoff odds 74% · 97% with a win · 49% with a loss"
const stakesText = (side) => {
  const parts = [`Playoff odds ${side.now}`];

  if (side.win) {
    parts.push(`${side.win} with a win`);
  }

  if (side.loss) {
    parts.push(`${side.loss} with a loss`);
  }

  return parts.join(' · ');
};

const GameOfTheWeek = ({ game }) => (
  <SectionCard title={`Game of the week · week ${game.week}`} sx={{ mb: 3 }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
      {game.sides.map((side) => (
        <Box key={side.name} sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{side.name}</Typography>
          <Typography variant="body2" color="text.secondary">{stakesText(side)}</Typography>
        </Box>
      ))}
    </Box>
    {game.series && <Typography variant="body2" sx={{ mt: 1.5 }}>{game.series}</Typography>}
  </SectionCard>
);

const ScoreLine = ({ name, points, won }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
    <Typography sx={{ fontWeight: won ? 700 : 400, minWidth: 0 }} noWrap>{name}</Typography>
    <Typography sx={{ fontWeight: won ? 700 : 400, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{points.toFixed(2)}</Typography>
  </Box>
);

const Scoreboard = ({ recap, names }) => (
  <SectionCard title="Scoreboard">
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3 }}>
      {recap.games.map((g) => (
        <Box key={`${g.home}-${g.away}`} sx={{ py: 1, borderBottom: '1px solid var(--fa-border)' }}>
          <ScoreLine name={names[g.home]} points={g.home_points} won={g.winner === g.home} />
          <ScoreLine name={names[g.away]} points={g.away_points} won={g.winner === g.away} />
        </Box>
      ))}
    </Box>
  </SectionCard>
);

// One week's recap: every item, next week's biggest game in the stretch run,
// and the scoreboard, with links to the weeks either side
const RecapPage = () => {
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const { year: yearParam, week: weekParam } = useParams();
  const history = useHistory();
  const year = Number(yearParam);
  const week = Number(weekParam);
  const { data: recap, loading, error } = useApi(
    leagueInfo.id && year && week ? `/recap?leagueId=${leagueInfo.id}&year=${year}&week=${week}` : null
  );

  const names = useMemo(() => Object.fromEntries((recap?.teams ?? []).map((t) => [t.team_id, t.name])), [recap]);
  const items = recap ? recapItems(recap, names, Number(leagueInfo.established)) : [];
  const game = recap ? gameOfTheWeek(recap, names) : null;

  const latest = recap?.latest_week ?? 0;
  const weeks = Array.from({ length: latest }, (_, i) => i + 1);
  const nav = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button component={Link} to={recapPath(year, week - 1)} disabled={week <= 1} startIcon={<ChevronLeftIcon />} sx={{ flexShrink: 0 }}>
        Prev
      </Button>
      {/* No floating label: every option already says "Week N" */}
      <FormControl size="small" sx={{ flex: { xs: 1, md: 'none' }, minWidth: 110 }}>
        <Select
          id="recap-week"
          inputProps={{ 'aria-label': 'Week' }}
          value={weeks.includes(week) ? week : ''}
          onChange={(e) => history.push(recapPath(year, e.target.value))}
        >
          {weeks.map((w) => <MenuItem value={w} key={w}>Week {w}</MenuItem>)}
        </Select>
      </FormControl>
      <Button component={Link} to={recapPath(year, week + 1)} disabled={week >= latest} endIcon={<ChevronRightIcon />} sx={{ flexShrink: 0 }}>
        Next
      </Button>
    </Box>
  );

  const isCurrent = year === currentSeason(leagueInfo);
  const subtitle = (
    <>
      {year} season{recap?.playoffs ? ' · Playoffs' : ''}
      {!isCurrent && <> · <MuiLink component={Link} to={`/seasons/${year}`}>Season recap</MuiLink></>}
    </>
  );

  let content;
  if (loading) {
    content = <LoadingState inline variant="card" title={false} />;
  } else if (error || !recap) {
    content = <Typography color="text.secondary">{error?.message ?? 'No recap for this week.'}</Typography>;
  } else {
    content = (
      <>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
          {items.map((item) => <RecapItemCard key={item.key} item={item} />)}
        </Box>

        {game && <GameOfTheWeek game={game} />}

        <Scoreboard recap={recap} names={names} />
      </>
    );
  }

  return (
    <PageLayout maxWidth={1000} title={`Week ${week} recap`} subtitle={subtitle} actions={nav}>
      {content}
    </PageLayout>
  );
};

export default RecapPage;
