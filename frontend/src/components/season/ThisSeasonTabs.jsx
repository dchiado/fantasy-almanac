import React from "react";
import { Tab, Tabs } from "@mui/material";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { activePage, thisSeasonPages } from "../../utils/seasons";

// Sub-tabs across the current season's pages, on phones only: on desktop the
// header already lists them
const ThisSeasonTabs = () => {
  const { pathname } = useLocation();
  const leagueInfo = useSelector((state) => state.leagueInfo);

  return (
    <Tabs
      value={activePage(pathname)}
      variant="fullWidth"
      sx={{ display: { xs: 'flex', md: 'none' }, mb: 2, mt: -1, borderBottom: '1px solid var(--fa-border)' }}
    >
      {thisSeasonPages(leagueInfo).map((page) => (
        <Tab key={page.key} value={page.key} label={page.shortLabel} component={Link} to={page.to} sx={{ minWidth: 0, px: 1 }} />
      ))}
    </Tabs>
  );
};

export default ThisSeasonTabs;
