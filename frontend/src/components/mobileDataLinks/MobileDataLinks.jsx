import React from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import TableChartIcon from '@mui/icons-material/TableChart';
import PeopleIcon from '@mui/icons-material/People';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import ListIcon from '@mui/icons-material/List';
import { Link } from "react-router-dom";

const MobileDataLinks = () => {
  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center' }}>
      <nav aria-label="main data links">
        <List>
          <ListItem disablePadding component={Link} to="/standings" sx={{ color: 'white' }}>
            <ListItemButton>
              <ListItemIcon>
                <TableChartIcon sx={{ color: 'white' }}/>
              </ListItemIcon>
              <ListItemText primary="All-time Standings" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding component={Link} to="/head-to-head" sx={{ color: 'white' }}>
            <ListItemButton>
              <ListItemIcon>
                <PeopleIcon sx={{ color: 'white' }}/>
              </ListItemIcon>
              <ListItemText primary="Head-to-head" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding component={Link} to="/records" sx={{ color: 'white' }}>
            <ListItemButton>
              <ListItemIcon>
                <WorkspacePremiumIcon sx={{ color: 'white' }}/>
              </ListItemIcon>
              <ListItemText primary="Records" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding component={Link} to="/power-rankings" sx={{ color: 'white' }}>
            <ListItemButton>
              <ListItemIcon>
                <ListIcon sx={{ color: 'white' }}/>
              </ListItemIcon>
              <ListItemText primary="Power Rankings" />
            </ListItemButton>
          </ListItem>
        </List>
      </nav>
    </Box>
  )
}

export default MobileDataLinks;