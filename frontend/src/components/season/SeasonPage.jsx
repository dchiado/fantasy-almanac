import React from "react";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { Link, Redirect, useHistory, useParams } from "react-router-dom";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import LineupTable from "./LineupTable";
import { PlayoffOddsOrReason, ScheduleSwap, StandingsTable, useSeasonReport } from "./sections";
import { latestRecapSeason, leaguePath, recapPath } from "../../utils/seasons";

// Links to every week's recap, regular season then playoffs
const WeeklyRecaps = ({ leagueId, report }) => {
  const weeks = Array.from({ length: report.weeks_played ?? 0 }, (_, i) => i + 1);
  if (weeks.length === 0) return null;
  const groups = [
    ['Regular season', weeks.filter((w) => w <= report.regular_season_weeks)],
    ['Playoffs', weeks.filter((w) => w > report.regular_season_weeks)],
  ].filter(([, group]) => group.length > 0);

  return (
    <SectionCard title="Weekly recaps" sx={{ mb: 3 }}>
      {groups.map(([label, group]) => (
        <Box key={label} sx={{ '& + &': { mt: 1.5 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))', gap: 1 }}>
            {group.map((w) => (
              <Button key={w} component={Link} to={leaguePath(leagueId, recapPath(report.year, w))} variant="outlined" size="small" sx={{ minWidth: 0 }}>
                {w}
              </Button>
            ))}
          </Box>
        </Box>
      ))}
    </SectionCard>
  );
};

// A past season's recap (History → Past seasons): odds by week with the
// highlights, links to each week's recap, final standings with luck, points
// left on the bench, and the schedule swap grid
const SeasonPage = ({ setError }) => {
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const { year: yearParam } = useParams();
  const history = useHistory();
  const latest = latestRecapSeason(leagueInfo);
  const year = Number(yearParam) || null;
  // The season under way lives on the current season's pages
  const inProgress = year && latest && year > latest;
  const { report, loading, names, abbrevs } = useSeasonReport(leagueInfo.id, inProgress ? null : year, setError);

  if (!year || inProgress) {
    if (!latest) return <LoadingState rows={12} />;
    return <Redirect to={leaguePath(leagueInfo.id, inProgress ? '/playoffs' : `/seasons/${latest}`)} />;
  }

  const firstYear = Number(leagueInfo.established) || null;
  const years = firstYear ? Array.from({ length: latest - firstYear + 1 }, (_, i) => latest - i) : [];
  const picker = years.length > 0 && (
    <FormControl sx={{ minWidth: 120 }}>
      <InputLabel id="season-year-label">Season</InputLabel>
      <Select
        labelId="season-year-label"
        id="season-year"
        label="Season"
        value={years.includes(year) ? year : ''}
        onChange={(e) => history.push(leaguePath(leagueInfo.id, `/seasons/${e.target.value}`))}
      >
        {years.map((y) => <MenuItem value={y} key={y}>{y}</MenuItem>)}
      </Select>
    </FormControl>
  );

  const finish = report?.has_playoffs ? `${report.playoff_team_count} made the playoffs` : 'no playoffs';
  const subtitle = report && `${report.teams.length} teams · ${finish}`;

  return (
    <PageLayout maxWidth={1000} title={`${year} season`} subtitle={subtitle} actions={picker}>
      {loading || !report
        ? <LoadingState inline rows={12} title={false} />
        : <>
            <PlayoffOddsOrReason report={report} names={names} />
            <WeeklyRecaps leagueId={leagueInfo.id} report={report} />
            <StandingsTable report={report} names={names} />
            <LineupTable leagueId={leagueInfo.id} year={year} names={names} />
            <ScheduleSwap report={report} names={names} abbrevs={abbrevs} />
          </>
      }
    </PageLayout>
  );
};

export default SeasonPage;
