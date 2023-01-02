import React from 'react';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import EditIcon from '@mui/icons-material/Edit';

const FooterMobile = () => {
  return (
    <Box sx={{ width: '100%', display: { xs: 'block', sm: 'none' }}}>
      <BottomNavigation
        showLabels
        sx={{
          backgroundColor: '#444242',
          "& .Mui-selected, svg": {
            color: "lightgray"
          },
       }}
      >
        <BottomNavigationAction
          label="Home"
          href="/"
          sx={{ color: 'lightgray' }}
          icon={<HomeIcon style={{ color: 'lightgray' }} />}
        />
        <BottomNavigationAction
          label="Data"
          href="/mobile-data-links"
          sx={{ color: 'lightgray' }}
          icon={<MenuIcon style={{ color: 'lightgray' }} />}
        />
        <BottomNavigationAction
          label="League"
          href="/league-info-mobile"
          sx={{ color: 'lightgray' }}
          icon={<EditIcon style={{ color: 'lightgray' }} />}
        />
      </BottomNavigation>
    </Box>
  );
}

export default FooterMobile;