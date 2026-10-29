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
import ThisSeasonTabs from "../season/ThisSeasonTabs";
import { currentSeason, latestRecapSeason, leaguePath, recapPath, seasonStarted } from "../../utils/seasons";
import { benchBlunders, gameOfTheWeek, recapItems } from "./recapItems";

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

// "Playoff odds 74% · 97% with a win · 49% with a loss"; odds is "Playoff" or "Title"
const stakesText = (side, odds) => {
  const parts = [`${odds} odds ${side.now}`];

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
          <Typography variant="body2" color="text.secondary">{stakesText(side, game.odds)}</Typography>
        </Box>
      ))}
    </Box>
    {game.series && <Typography variant="body2" sx={{ mt: 1.5 }}>{game.series}</Typography>}
  </SectionCard>
);

const BenchBlunders = ({ blunders }) => (
  <SectionCard title="Bench blunders" sx={{ mb: 3 }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Lost, but would have won with their best lineup.
    </Typography>
    {blunders.map((b) => (
      <Box key={b.key} sx={{ py: 1.5, borderTop: '1px solid var(--fa-border)' }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{b.name}</Typography>
        <Typography variant="body2" color="text.secondary">{b.result}</Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>{b.swap}</Typography>
      </Box>
    ))}
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

// The /recap API path: one week, or without a week the latest one played
const apiPath = (leagueId, year, week) => {
  if (week) {
    return `/recap?leagueId=${leagueId}&year=${year}&week=${week}`;
  }

  return `/recap?leagueId=${leagueId}&year=${year}`;
};

// One week's recap: every item, the bench blunders, next week's biggest game
// in the stretch run, and the scoreboard, with links to the weeks either side.
// At /recap, with no year or week in the path, the current season's latest week.
const RecapPage = () => {
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const { year: yearParam, week: weekParam } = useParams();
  const history = useHistory();
  const latestWeek = !weekParam;
  const year = Number(yearParam) || currentSeason(leagueInfo);
  const started = !latestWeek || seasonStarted(leagueInfo);

  let path = null;
  if (leagueInfo.id && year && started) {
    path = apiPath(leagueInfo.id, year, Number(weekParam));
  }

  const { data: recap, loading, error } = useApi(path);
  const week = Number(weekParam) || recap?.week || 0;

  const names = useMemo(() => Object.fromEntries((recap?.teams ?? []).map((t) => [t.team_id, t.name])), [recap]);
  const items = recap ? recapItems(recap, names, Number(leagueInfo.established)) : [];
  const game = recap ? gameOfTheWeek(recap, names) : null;
  const blunders = recap ? benchBlunders(recap, names) : [];

  const latest = recap?.latest_week ?? 0;
  const weeks = Array.from({ length: latest }, (_, i) => i + 1);
  const nav = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button component={Link} to={leaguePath(leagueInfo.id, recapPath(year, week - 1))} disabled={week <= 1} startIcon={<ChevronLeftIcon />} sx={{ flexShrink: 0 }}>
        Prev
      </Button>
      {/* No floating label: every option already says "Week N" */}
      <FormControl size="small" sx={{ flex: { xs: 1, md: 'none' }, minWidth: 110 }}>
        <Select
          id="recap-week"
          inputProps={{ 'aria-label': 'Week' }}
          value={weeks.includes(week) ? week : ''}
          onChange={(e) => history.push(leaguePath(leagueInfo.id, recapPath(year, e.target.value)))}
        >
          {weeks.map((w) => <MenuItem value={w} key={w}>Week {w}</MenuItem>)}
        </Select>
      </FormControl>
      <Button component={Link} to={leaguePath(leagueInfo.id, recapPath(year, week + 1))} disabled={week >= latest} endIcon={<ChevronRightIcon />} sx={{ flexShrink: 0 }}>
        Next
      </Button>
    </Box>
  );

  const isCurrent = year === currentSeason(leagueInfo);
  const subtitle = (
    <>
      {year} season{recap?.playoffs ? ' · Playoffs' : ''}
      {!isCurrent && <> · <MuiLink component={Link} to={leaguePath(leagueInfo.id, `/seasons/${year}`)}>Season recap</MuiLink></>}
    </>
  );

  let content;
  if (!started) {
    content = (
      <Typography color="text.secondary">
        The {year} season starts after the draft.{' '}
        <MuiLink component={Link} to={leaguePath(leagueInfo.id, `/seasons/${latestRecapSeason(leagueInfo)}`)}>
          See the {latestRecapSeason(leagueInfo)} season
        </MuiLink>
      </Typography>
    );
  } else if (loading) {
    content = <LoadingState inline variant="card" title={false} />;
  } else if (latestWeek && error) {
    // Most likely no week has been played yet
    content = <Typography color="text.secondary">The first recap comes after week 1.</Typography>;
  } else if (error || !recap) {
    content = <Typography color="text.secondary">{error?.message ?? 'No recap for this week.'}</Typography>;
  } else {
    content = (
      <>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2, mb: 3 }}>
          {items.map((item) => <RecapItemCard key={item.key} item={item} />)}
        </Box>

        {blunders.length > 0 && <BenchBlunders blunders={blunders} />}

        {game && <GameOfTheWeek game={game} />}

        <Scoreboard recap={recap} names={names} />
      </>
    );
  }

  return (
    <PageLayout
      maxWidth={1000}
      title={week ? `Week ${week} recap` : 'Weekly recap'}
      subtitle={subtitle}
      actions={week > 0 && nav}
      nav={isCurrent && <ThisSeasonTabs />}
    >
      {content}
    </PageLayout>
  );
};

export default RecapPage;
