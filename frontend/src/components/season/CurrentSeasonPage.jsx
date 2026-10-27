import React from "react";
import { Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import ThisSeasonTabs from "./ThisSeasonTabs";
import { PlayoffOddsOrReason, PlayoffPictureSection, ScheduleSwap, StandingsTable, useSeasonReport } from "./sections";
import { currentSeason, latestRecapSeason, seasonStarted } from "../../utils/seasons";

const TITLES = { playoffs: 'Playoff race', standings: 'Standings' };

/**
 * One of the current season's pages: "playoffs" (the stretch-run picture and
 * odds by week) or "standings" (standings with luck, and the schedule swap grid).
 */
const CurrentSeasonPage = ({ section, setError }) => {
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const year = currentSeason(leagueInfo);
  const started = seasonStarted(leagueInfo);
  const { report, loading, names, abbrevs } = useSeasonReport(leagueInfo.id, started ? year : null, setError);

  const subtitle = !year ? null
    : !started ? `${year} season · not started yet`
    : !report ? `${year} season`
    : report.completed_weeks === report.regular_season_weeks ? `${year} season · regular season over`
    : `${year} season · through week ${report.completed_weeks} of ${report.regular_season_weeks}`;

  let content;
  if (!started) {
    content = (
      <SectionCard>
        <Typography color="text.secondary">
          The {year} season starts after the draft.{' '}
          <Link to={`/seasons/${latestRecapSeason(leagueInfo)}`} style={{ color: 'var(--fa-primary)' }}>
            See the {latestRecapSeason(leagueInfo)} season
          </Link>
        </Typography>
      </SectionCard>
    );
  } else if (loading || !report) {
    content = <LoadingState inline rows={12} title={false} />;
  } else if (report.completed_weeks === 0) {
    content = <SectionCard><Typography color="text.secondary">This fills in after week 1.</Typography></SectionCard>;
  } else if (section === 'playoffs') {
    content = (
      <>
        {report.scenarios && <PlayoffPictureSection report={report} />}
        <PlayoffOddsOrReason report={report} names={names} />
      </>
    );
  } else {
    content = (
      <>
        <StandingsTable report={report} names={names} />
        <ScheduleSwap report={report} names={names} abbrevs={abbrevs} />
      </>
    );
  }

  return (
    <PageLayout maxWidth={1000} title={TITLES[section]} subtitle={subtitle} nav={<ThisSeasonTabs />}>
      {content}
    </PageLayout>
  );
};

export default CurrentSeasonPage;
