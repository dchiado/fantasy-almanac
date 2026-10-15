import React from 'react';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import EditIcon from '@mui/icons-material/Edit';
import { Link, useLocation } from 'react-router-dom';
import './FooterMobile.css';

const tabForPath = (pathname) => {
  if (pathname === '/') return '/';
  if (pathname.startsWith('/league-info-mobile') || pathname.startsWith('/suggestions')) return '/league-info-mobile';
  return '/mobile-data-links';
};

const FooterMobile = () => {
  const { pathname } = useLocation();

  return (
    <Paper className='mobile-footer' square elevation={0}>
      <BottomNavigation showLabels value={tabForPath(pathname)}>
        <BottomNavigationAction label="Home" value="/" component={Link} to="/" icon={<HomeIcon />} />
        <BottomNavigationAction label="Data" value="/mobile-data-links" component={Link} to="/mobile-data-links" icon={<MenuIcon />} />
        <BottomNavigationAction label="League" value="/league-info-mobile" component={Link} to="/league-info-mobile" icon={<EditIcon />} />
      </BottomNavigation>
    </Paper>
  );
}

export default FooterMobile;
