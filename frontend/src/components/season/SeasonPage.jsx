import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { useSelector } from "react-redux";
import { Redirect, useHistory, useParams } from "react-router-dom";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import { PlayoffOddsOrReason, ScheduleSwap, StandingsTable, useSeasonReport } from "./sections";
import { latestRecapSeason } from "../../utils/seasons";

// A past season's recap (History → Past seasons): odds by week with the
// highlights, final standings with luck, and the schedule swap grid
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
    return <Redirect to={inProgress ? '/playoffs' : `/seasons/${latest}`} />;
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
        onChange={(e) => history.push(`/seasons/${e.target.value}`)}
      >
        {years.map((y) => <MenuItem value={y} key={y}>{y}</MenuItem>)}
      </Select>
    </FormControl>
  );

  const subtitle = report && `${report.teams.length} teams · ${report.playoff_team_count} made the playoffs`;

  return (
    <PageLayout maxWidth={1000} title={`${year} season`} subtitle={subtitle} actions={picker}>
      {loading || !report
        ? <LoadingState inline rows={12} title={false} />
        : <>
            <PlayoffOddsOrReason report={report} names={names} />
            <StandingsTable report={report} names={names} />
            <ScheduleSwap report={report} names={names} abbrevs={abbrevs} />
          </>
      }
    </PageLayout>
  );
};

export default SeasonPage;
