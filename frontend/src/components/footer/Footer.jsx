import React from "react";
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import './Footer.css';

const Footer = () => {
	return (
    <div className='footer'>
      <BottomNavigation
        showLabels
        sx={{
          width: '100%',
          backgroundColor: '#444242',
          display: { xs: 'none', sm: 'flex' },
          justifyContent: 'flex-start'
        }}
      >
        <BottomNavigationAction label="Feature Suggestions" href="/suggestions" sx={{ color: 'white' }} />
        {/* <BottomNavigationAction label="Buy Me a Coffee" href='https://venmo.com/dylan-chiado' target="_blank" sx={{ color: 'white' }} /> */}
      </BottomNavigation>
    </div>
	);
}

export default Footer;
