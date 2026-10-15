import React from 'react';
import { Button, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useCookies } from 'react-cookie';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import "./LeagueInfoMobile.css";

const LeagueInfoMobile = ({ onLeagueIdChange, onLeagueInfoSubmit }) => {
  const leagueInfo = useSelector((state) => state.leagueInfo)
	const [,, removeCookie] = useCookies(["league_id"]);

  const handleRemoveCookie = () => {
    removeCookie("league_id", {
      path: "/"
    });
  }

  return (
    <div className="wrapper">
      {leagueInfo?.name &&
        <Box sx={{ display: { md: 'flex', paddingLeft: 10 } }}>
          <Typography
          variant="h6"
          sx={{
            display: { md: 'flex' },
            fontWeight: 600,
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
      <Button component={Link} to="/suggestions" sx={{ mt: 4, color: 'text.secondary' }}>
        Suggest a feature
      </Button>
    </div>
  )
}

export default LeagueInfoMobile;