import React from 'react';
import { Button, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useCookies } from 'react-cookie';
import { useSelector } from 'react-redux';

const LeagueInfoMobile = ({ onLeagueIdChange, onLeagueInfoSubmit }) => {
  const leagueInfo = useSelector((state) => state.leagueInfo)
	const [,, removeCookie] = useCookies(["league_id"]);

  const handleRemoveCookie = () => {
    removeCookie("league_id", {
      path: "/"
    });
  }

  return (
    <div>
      {leagueInfo?.name &&
        <Box sx={{ display: { md: 'flex', paddingLeft: 10 } }}>
          <Typography
          variant="h6"
          sx={{
            display: { md: 'flex' },
            fontWeight: 600,
            letterSpacing: '.25rem',
            color: 'inherit',
            textDecoration: 'none',
          }}
          >
            {leagueInfo.name}
          </Typography>
          <Button
            variant="contained"
            key='league-name'
            href="/"
            onClick={handleRemoveCookie}
            sx={{ color: 'inherit', display: 'block', marginTop: '20px' }}
          >
            Change
          </Button>
      </Box>          
      }
    </div>
  )
}

export default LeagueInfoMobile;