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
import { THIS_SEASON_KEYS, activePage, leaguePath } from '../../utils/seasons';
import './FooterMobile.css';

// The current season's pages share one tab here; ThisSeasonTabs switches between them
const tabFor = (page) => (THIS_SEASON_KEYS.includes(page) ? 'this-season' : page);

// Keep labels on one line, at one size: MUI enlarges the selected one, which wraps "This season"
const actionSx = { minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label, & .MuiBottomNavigationAction-label.Mui-selected': { fontSize: 12, whiteSpace: 'nowrap' } };

const FooterMobile = () => {
  const { pathname } = useLocation();
  const leagueInfo = useSelector((state) => state.leagueInfo);

  return (
    <Paper className='mobile-footer' square elevation={0}>
      <BottomNavigation showLabels value={tabFor(activePage(pathname, leagueInfo))}>
        <BottomNavigationAction label="Home" value="home" component={Link} to={leaguePath(leagueInfo.id)} icon={<HomeIcon />} sx={actionSx} />
        <BottomNavigationAction label="This season" value="this-season" component={Link} to={leaguePath(leagueInfo.id, '/recap')} icon={<ScoreboardIcon />} sx={actionSx} />
        <BottomNavigationAction label="History" value="history" component={Link} to={leaguePath(leagueInfo.id, '/history')} icon={<MenuBookIcon />} sx={actionSx} />
        <BottomNavigationAction label="League" value="league" component={Link} to={leaguePath(leagueInfo.id, '/league-info-mobile')} icon={<EditIcon />} sx={actionSx} />
      </BottomNavigation>
    </Paper>
  );
}

export default FooterMobile;
