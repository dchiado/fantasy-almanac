import React from 'react';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EditIcon from '@mui/icons-material/Edit';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { activeTab, navTabs } from '../../utils/seasons';
import './FooterMobile.css';

const ICONS = { 'this-season': <ScoreboardIcon />, seasons: <CalendarMonthIcon />, history: <MenuBookIcon /> };

// Five tabs at phone width, so drop MUI's 80px minimum and most of the side padding
const actionSx = { minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: 11, whiteSpace: 'nowrap' }, '& .Mui-selected': { fontSize: 11 } };

const FooterMobile = () => {
  const { pathname } = useLocation();
  const leagueInfo = useSelector((state) => state.leagueInfo);

  return (
    <Paper className='mobile-footer' square elevation={0}>
      <BottomNavigation showLabels value={activeTab(pathname, leagueInfo)}>
        <BottomNavigationAction label="Home" value="home" component={Link} to="/" icon={<HomeIcon />} sx={actionSx} />
        {navTabs(leagueInfo).map((tab) => (
          <BottomNavigationAction key={tab.key} label={tab.label} value={tab.key} component={Link} to={tab.to} icon={ICONS[tab.key]} sx={actionSx} />
        ))}
        <BottomNavigationAction label="League" value="league" component={Link} to="/league-info-mobile" icon={<EditIcon />} sx={actionSx} />
      </BottomNavigation>
    </Paper>
  );
}

export default FooterMobile;
