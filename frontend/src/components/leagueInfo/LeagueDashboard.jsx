import React, { useMemo } from "react";
import { Box, Button, Paper, Skeleton, Typography } from "@mui/material";
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import useApi from "../../hooks/useApi";
import MovementBadge from "../ui/MovementBadge";
import { DEFAULT_WEIGHTS, rankWithMovement } from "../../utils/powerRankings";
import PlayoffPicture from "../season/PlayoffPicture";
import { formatPct, formatRecord, formatSigned, oddsName, spots } from "../season/format";
import { homeItems, recapItems } from "../recap/recapItems";
import { leaguePath, recapPath } from "../../utils/seasons";
import { listText } from "../../utils/text";

// `to` is a path within the league, like the rest of the app's links
const DashCard = ({ title, to, linkLabel, sx, children }) => {
  const leagueId = useSelector((state) => state.leagueInfo.id);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', flexDirection: 'column', minWidth: 0, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="overline" component="h2" color="text.secondary">{title}</Typography>
        {to &&
          <Button component={Link} to={leaguePath(leagueId, to)} size="small" endIcon={<ArrowForwardIcon fontSize="small" />} sx={{ mr: -1 }}>
            {linkLabel}
          </Button>
        }
      </Box>
      {children}
    </Paper>
  );
};

const CardSkeleton = ({ lines = 4 }) => (
  <Box>
    {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} height={32} />)}
  </Box>
);

const Unavailable = ({ children = 'Not available yet.' }) => (
  <Typography variant="body2" color="text.secondary">{children}</Typography>
);

// A ranked line: position, name, optional extra, value on the right
const RankRow = ({ place, name, extra, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid var(--fa-border)', '&:last-of-type': { borderBottom: 0 } }}>
    <Typography sx={{ width: 20, textAlign: 'right', color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{place}</Typography>
    {extra}
    <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }} noWrap>{name}</Typography>
    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{value}</Typography>
  </Box>
);

// First paragraph of the markdown writeup as plain text
const teaser = (markdown) => (markdown || '')
  .split(/\n\s*\n/)
  .map((p) => p.replace(/[#*_>`]/g, '').trim())
  .find(Boolean);

const PowerRankingsCard = ({ leagueId }) => {
  const { data, loading, error } = useApi(`/power-rankings?leagueId=${leagueId}`);
  const top = useMemo(() => data?.teams?.length ? rankWithMovement(data.teams, DEFAULT_WEIGHTS).slice(0, 5) : [], [data]);
  const intro = teaser(data?.writeup);

  return (
    <DashCard title="Power rankings" to="/power-rankings" linkLabel="Full rankings">
      {loading ? <CardSkeleton lines={5} />
        : error || top.length === 0 ? <Unavailable>Rankings start once the season does.</Unavailable>
        : <>
            {top.map((team, idx) => (
              <RankRow
                key={team.name}
                place={idx + 1}
                name={team.name}
                extra={<MovementBadge movement={team.movement} />}
                value={`${team.wins}-${team.games ? team.games.length - team.wins : '?'}`}
              />
            ))}
            {intro &&
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              >
                {intro}
              </Typography>
            }
          </>
      }
    </DashCard>
  );
};

const summarizeStandings = (standings) => {
  const currentSeason = standings.seasons[standings.seasons.length - 1];

  const owners = standings.teams.map((t) => {
    const wins = t.seasons.reduce((a, s) => a + s.wins, 0);
    const losses = t.seasons.reduce((a, s) => a + s.losses, 0);
    return {
      name: t.name,
      seasons: t.seasons.length,
      // Same rule as the Standings page's "Active teams" toggle
      active: t.seasons.some((s) => s.year === currentSeason),
      wins,
      losses,
      winPct: wins + losses > 0 ? wins / (wins + losses) : 0,
      titles: t.seasons.filter((s) => s.playoff_champ).map((s) => s.year),
    };
  });

  const champions = standings.teams
    .flatMap((t) => t.seasons.filter((s) => s.playoff_champ).map((s) => ({ name: t.name, year: s.year })))
    .sort((a, b) => b.year - a.year);

  const mostTitles = Math.max(0, ...owners.map((o) => o.titles.length));

  // Active owners only; skip one-season wonders unless the league is too young to have veterans
  const minSeasons = Math.min(3, standings.seasons.length);
  const leaders = owners
    .filter((o) => o.active && o.seasons >= minSeasons)
    .sort((a, b) => b.winPct - a.winPct)
    .slice(0, 5);

  return {
    reigning: champions[0],
    recentChampions: champions.slice(1, 4),
    titleLeaders: mostTitles > 0 ? owners.filter((o) => o.titles.length === mostTitles) : [],
    mostTitles,
    leaders,
  };
};

const ChampionsCard = ({ summary, loading, error }) => (
  <DashCard title="Champions" to="/seasons" linkLabel="Past seasons">
    {loading ? <CardSkeleton lines={3} />
      : error || !summary?.reigning ? <Unavailable>No champions crowned yet.</Unavailable>
      : <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 2, bgcolor: 'var(--fa-gold)', color: '#1A1300', flexShrink: 0 }}>
              <EmojiEventsIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" color="text.secondary">Reigning champ · {summary.reigning.year}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{summary.reigning.name}</Typography>
            </Box>
          </Box>
          {summary.recentChampions.length > 0 &&
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Before that: {listText(summary.recentChampions.map((c) => `${c.name} (${c.year})`))}
            </Typography>
          }
          {summary.mostTitles > 0 &&
            <Typography variant="body2" sx={{ mt: 1 }}>
              <Box component="span" sx={{ color: 'text.secondary' }}>Most titles: </Box>
              <strong>{listText(summary.titleLeaders.map((o) => o.name))}</strong> ({summary.mostTitles})
            </Typography>
          }
        </>
    }
  </DashCard>
);

const LeadersCard = ({ summary, loading, error }) => (
  <DashCard title="Active career win %" to="/all-time-standings" linkLabel="All-time Standings">
    {loading ? <CardSkeleton lines={5} />
      : error || !summary?.leaders.length ? <Unavailable />
      : summary.leaders.map((o, idx) => (
          <RankRow
            key={o.name}
            place={idx + 1}
            name={o.name}
            extra={null}
            value={
              <>
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, mr: 1.5 }}>{o.wins}-{o.losses}</Box>
                {(o.winPct * 100).toFixed(1)}%
              </>
            }
          />
        ))
    }
  </DashCard>
);

const BestWeeksCard = ({ leagueId }) => {
  const { data, loading, error } = useApi(`/individual-weeks?leagueId=${leagueId}&bestworst=best&playoffs=false&count=5`);

  return (
    <DashCard title="Best weeks ever" to="/records" linkLabel="Records">
      {loading ? <CardSkeleton lines={5} />
        : error || !data?.length ? <Unavailable />
        : data.map((w, idx) => (
            <RankRow
              key={`${w.year}-${w.week}-${w.team_name}`}
              place={idx + 1}
              name={w.team_name}
              extra={null}
              value={
                <>
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, mr: 1.5 }}>{w.year} Wk {w.week}</Box>
                  {w.score}
                </>
              }
            />
          ))
      }
    </DashCard>
  );
};

// The season report's latest playoff odds, best first, with the change since the week before
const latestOdds = (report) => {
  const weeks = report.playoff_odds?.weeks ?? [];
  const [previous, latest] = weeks.slice(-2);
  if (!latest || latest.week === 0) return [];
  return latest.teams
    .map((t) => ({ ...t, change: t.playoff_pct - (previous?.teams.find((p) => p.team_id === t.team_id)?.playoff_pct ?? t.playoff_pct) }))
    .sort((a, b) => b.playoff_pct - a.playoff_pct);
};

// Teams the odds card shows: the playoff teams, or the top few title contenders
const TITLE_CONTENDERS = 4;

const PlayoffOddsCard = ({ leagueId, year }) => {
  const { data: report, loading, error } = useApi(`/season?leagueId=${leagueId}&year=${year}`);
  const shown = report?.has_playoffs ? report.playoff_team_count : TITLE_CONTENDERS;
  const odds = report ? latestOdds(report).slice(0, shown) : [];
  const names = Object.fromEntries((report?.teams ?? []).map((t) => [t.team_id, t.name]));
  const name = report ? oddsName(report) : 'Playoff';

  return (
    <DashCard title={report ? `${name} odds · after week ${report.completed_weeks}` : `${name} odds`} to="/playoffs" linkLabel={`${name} race`}>
      {loading ? <CardSkeleton lines={6} />
        : error || odds.length === 0 ? <Unavailable>Odds start after week 1.</Unavailable>
        : odds.map((t, idx) => (
            <RankRow
              key={t.team_id}
              place={idx + 1}
              name={names[t.team_id]}
              extra={null}
              value={
                <>
                  {Math.abs(t.change) >= 0.005 &&
                    <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, mr: 1.5 }}>{formatSigned(t.change * 100, 0)}</Box>
                  }
                  {formatPct(t.playoff_pct)}
                </>
              }
            />
          ))
      }
    </DashCard>
  );
};

const PlayoffPictureCard = ({ leagueId, year }) => {
  const { data: report, loading, error } = useApi(`/season?leagueId=${leagueId}&year=${year}`);

  return (
    <DashCard title={report?.scenarios ? `${oddsName(report)} picture · week ${report.scenarios.week}` : 'Playoff picture'} to="/playoffs" linkLabel="Everyone">
      {loading ? <CardSkeleton lines={6} />
        : error || !report?.scenarios ? <Unavailable />
        : <PlayoffPicture report={report} limit={spots(report) + 2} />
      }
    </DashCard>
  );
};

// One line per highlight worth leading with: the champion, the biggest collapse
// and comeback, and the luckiest and unluckiest teams
const recapLines = (report) => {
  const names = Object.fromEntries(report.teams.map((t) => [t.team_id, t.name]));
  const champion = report.teams.find((t) => t.final_rank === 1);
  const highlights = report.highlights ?? [];
  const collapse = highlights.find((h) => h.type === 'collapse');
  const comeback = highlights.find((h) => h.type === 'comeback');
  const luckiest = report.luck[0];
  const unluckiest = report.luck[report.luck.length - 1];
  return [
    champion && { label: 'Champion', name: champion.name, value: formatRecord(champion) },
    collapse && { label: 'Biggest collapse', name: names[collapse.team_id], value: `peaked at ${formatPct(collapse.pct)}` },
    comeback && { label: 'Biggest comeback', name: names[comeback.team_id], value: `was at ${formatPct(comeback.pct)}` },
    luckiest && { label: 'Luckiest', name: names[luckiest.team_id], value: `${formatSigned(luckiest.luck)} wins` },
    unluckiest && { label: 'Unluckiest', name: names[unluckiest.team_id], value: `${formatSigned(unluckiest.luck)} wins` },
  ].filter(Boolean);
};

const SeasonRecapCard = ({ leagueId, year }) => {
  const { data: report, loading, error } = useApi(`/season?leagueId=${leagueId}&year=${year}`);
  const lines = report ? recapLines(report) : [];

  return (
    <DashCard title={`${year} season`} to={`/seasons/${year}`} linkLabel="Weekly Recap">
      {loading ? <CardSkeleton lines={5} />
        : error || lines.length === 0 ? <Unavailable />
        : lines.map((line) => (
            <Box key={line.label} sx={{ py: 0.75, borderBottom: '1px solid var(--fa-border)', '&:last-of-type': { borderBottom: 0 } }}>
              <Typography variant="body2" color="text.secondary">{line.label}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography sx={{ fontWeight: 600, minWidth: 0 }} noWrap>{line.name}</Typography>
                <Typography color="text.secondary" sx={{ flexShrink: 0 }}>{line.value}</Typography>
              </Box>
            </Box>
          ))
      }
    </DashCard>
  );
};

// The latest week's recap: the few items worth leading with
const WeeklyRecapCard = ({ leagueId, year, established }) => {
  const { data: recap, loading, error } = useApi(`/recap?leagueId=${leagueId}&year=${year}`);
  const names = useMemo(() => Object.fromEntries((recap?.teams ?? []).map((t) => [t.team_id, t.name])), [recap]);
  const items = recap ? homeItems(recapItems(recap, names, established)) : [];

  let content;
  if (loading) {
    content = <CardSkeleton lines={4} />;
  } else if (error || items.length === 0) {
    content = <Unavailable>The first recap comes after week 1.</Unavailable>;
  } else {
    // Two columns from md up, so no border under the last row there
    const lastRowStart = items.length - (items.length % 2 || 2);

    content = (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3 }}>
        {items.map((item, index) => {
          const border = '1px solid var(--fa-border)';
          const borderBottom = {
            xs: index === items.length - 1 ? 0 : border,
            md: index >= lastRowStart ? 0 : border,
          };

          return (
            <Box key={item.key} sx={{ py: 0.75, borderBottom }}>
              <Typography variant="body2" color="text.secondary">{item.title}</Typography>
              <Typography sx={{ fontWeight: 600 }}>{item.name}</Typography>
              {/* An all-time rank or "won it for them" says more than the detail */}
              {(item.badge || item.detail) &&
                <Typography variant="body2" color="text.secondary">{item.badge || item.detail}</Typography>
              }
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <DashCard
      title={recap ? `Week ${recap.week} recap` : 'Weekly recap'}
      to={recap && recapPath(year, recap.week)}
      linkLabel="Full recap"
      // Full width, so the four cards after it pair up evenly
      sx={{ gridColumn: '1 / -1' }}
    >
      {content}
    </DashCard>
  );
};

// Which cards Home shows, in order, for each phase of the current season
// (see "Season phases" in the README)
const CARDS_BY_PHASE = {
  preseason: ['recap', 'champions', 'leaders', 'bestWeeks'],
  regular_season: ['weeklyRecap', 'powerRankings', 'odds', 'champions', 'leaders'],
  stretch_run: ['weeklyRecap', 'picture', 'powerRankings', 'champions', 'leaders'],
  playoffs: ['recap', 'powerRankings', 'champions', 'leaders'],
  offseason: ['recap', 'champions', 'leaders', 'bestWeeks'],
};

const LeagueDashboard = ({ leagueInfo }) => {
  const standings = useApi(`/standings?leagueId=${leagueInfo.id}`);
  const summary = useMemo(() => standings.data?.teams ? summarizeStandings(standings.data) : null, [standings.data]);

  const year = Number(leagueInfo.year);
  // During the playoffs the regular season is over, so its recap is the current season's
  const recapYear = ['playoffs', 'offseason'].includes(leagueInfo.phase) ? year : year - 1;
  const cards = {
    powerRankings: <PowerRankingsCard key="powerRankings" leagueId={leagueInfo.id} />,
    odds: <PlayoffOddsCard key="odds" leagueId={leagueInfo.id} year={year} />,
    picture: <PlayoffPictureCard key="picture" leagueId={leagueInfo.id} year={year} />,
    recap: <SeasonRecapCard key="recap" leagueId={leagueInfo.id} year={recapYear} />,
    weeklyRecap: <WeeklyRecapCard key="weeklyRecap" leagueId={leagueInfo.id} year={year} established={Number(leagueInfo.established)} />,
    champions: <ChampionsCard key="champions" summary={summary} loading={standings.loading} error={standings.error} />,
    leaders: <LeadersCard key="leaders" summary={summary} loading={standings.loading} error={standings.error} />,
    bestWeeks: <BestWeeksCard key="bestWeeks" leagueId={leagueInfo.id} />,
  };

  const facts = [
    leagueInfo.established && `Est. ${leagueInfo.established}`,
    leagueInfo.teams && `${leagueInfo.teams} teams`,
    leagueInfo.year && `${leagueInfo.year} season${leagueInfo.week ? ` · Week ${leagueInfo.week}` : ''}`,
  ].filter(Boolean);

  return (
    <Box sx={{ width: '100%', maxWidth: 1100, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 5 }, boxSizing: 'border-box', textAlign: 'left' }}>
      <Typography variant="h3" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
        {leagueInfo.name}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: { xs: 3, sm: 4 } }}>
        {facts.join(' · ')}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {(CARDS_BY_PHASE[leagueInfo.phase] ?? CARDS_BY_PHASE.regular_season).map((card) => cards[card])}
      </Box>
    </Box>
  );
};

export default LeagueDashboard;
