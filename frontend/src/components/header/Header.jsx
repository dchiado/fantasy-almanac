import React, { useEffect, useState } from "react";
import './Header.css';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import { useSelector } from 'react-redux'
import { Link } from "react-router-dom";
import { useCookies } from "react-cookie";

const Header = () => {
  const leagueInfo = useSelector((state) => state.leagueInfo)
	const [,, removeCookie] = useCookies(["league_id"]);
  const [pages, setPages] = useState([
    {
      name: 'All-time Standings',
      link: '/standings',
    },
    {
      name: 'Head-to-Head',
      link: '/head-to-head',
    },
    {
      name: 'Records',
      link: '/records',
    },
    {
      name: 'Power Rankings',
      link: '/power-rankings',
    },
  ]);

  const handleRemoveCookie = () => {
    removeCookie("league_id", {
      path: "/"
    });
  }

  useEffect(() => {
		if (leagueInfo?.id === '166975' && !pages.find(p => p.name === 'Keepers')) {
      setPages([
        ...pages,
        {
          name: 'Keepers',
          link: '/keepers'
        }
      ]);
		}
	}, [leagueInfo, pages])

  return (
    <AppBar
      position="static"
      sx={{
        display: { xs: 'none', sm: 'flex' },
        backgroundColor: '#3B485D',
        color: 'white'
      }}
    >
      <Container maxWidth="xxl" sx={{ marginLeft: 0 }}>
        <Toolbar disableGutters>
          <Link to="/">
            <SportsFootballIcon sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1, color: 'white' }} />
          </Link>
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              mr: 5,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.25rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
            >
            FANTASY ALMANAC
          </Typography>
          {leagueInfo?.name &&
            <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'flex', gap: 20, paddingLeft: 10 } }}>
              {pages.map((page) => (
                <Button
                  key={page.name}
                  component={Link}
                  to={page.link}
                  sx={{ color: 'inherit', display: 'block' }}
                >
                  {page.name}
                </Button>
              ))}
            </Box>
          }
          {leagueInfo?.name &&
            <Box
              sx={{
                display: {
                  xs: 'none',
                  md: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  whiteSpace: 'nowrap',
                  paddingLeft: 10 }
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: '.25rem',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                {leagueInfo.name}
              </Typography>
              <Button
                key='league-name'
                href="/"
                onClick={handleRemoveCookie}
                sx={{ color: 'inherit', display: 'block', fontSize: 11, padding: 0 }}
              >
                (Change)
              </Button>
          </Box>          
          }
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Header;
