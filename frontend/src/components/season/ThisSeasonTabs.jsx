import React from "react";
import { Tab, Tabs } from "@mui/material";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { activePage, leaguePath, thisSeasonPages } from "../../utils/seasons";

// Sub-tabs across the current season's pages, on phones only: on desktop the
// header already lists them
const ThisSeasonTabs = () => {
  const { pathname } = useLocation();
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const pages = thisSeasonPages(leagueInfo).filter((page) => !page.desktopOnly);

  // The race is part of Standings here
  let value = activePage(pathname, leagueInfo);
  if (value === 'playoffs') {
    value = 'standings';
  }

  return (
    <Tabs
      value={value}
      variant="fullWidth"
      sx={{ display: { xs: 'flex', md: 'none' }, mb: 2, mt: -1, borderBottom: '1px solid var(--fa-border)' }}
    >
      {pages.map((page) => (
        <Tab key={page.key} value={page.key} label={page.shortLabel} component={Link} to={leaguePath(leagueInfo.id, page.to)} sx={{ minWidth: 0, px: 1 }} />
      ))}
    </Tabs>
  );
};

export default ThisSeasonTabs;
