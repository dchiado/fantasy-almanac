import React from 'react';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EditIcon from '@mui/icons-material/Edit';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { THIS_SEASON_PAGES, activePage, thisSeasonPath } from '../../utils/seasons';
import './FooterMobile.css';

// The current season's pages share one tab here; ThisSeasonTabs switches between them
const tabFor = (page) => (THIS_SEASON_PAGES.some((p) => p.key === page) ? 'this-season' : page);

// Keep labels on one line, at one size: MUI enlarges the selected one, which wraps "This season"
const actionSx = { minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label, & .MuiBottomNavigationAction-label.Mui-selected': { fontSize: 12, whiteSpace: 'nowrap' } };

const FooterMobile = () => {
  const { pathname } = useLocation();
  const leagueInfo = useSelector((state) => state.leagueInfo);

  return (
    <Paper className='mobile-footer' square elevation={0}>
      <BottomNavigation showLabels value={tabFor(activePage(pathname))}>
        <BottomNavigationAction label="Home" value="home" component={Link} to="/" icon={<HomeIcon />} sx={actionSx} />
        <BottomNavigationAction label="This season" value="this-season" component={Link} to={thisSeasonPath(leagueInfo)} icon={<ScoreboardIcon />} sx={actionSx} />
        <BottomNavigationAction label="History" value="history" component={Link} to="/history" icon={<MenuBookIcon />} sx={actionSx} />
        <BottomNavigationAction label="League" value="league" component={Link} to="/league-info-mobile" icon={<EditIcon />} sx={actionSx} />
      </BottomNavigation>
    </Paper>
  );
}

export default FooterMobile;
