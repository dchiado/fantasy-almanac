import React from "react";
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { useSelector } from 'react-redux'
import { Link, NavLink, useLocation } from "react-router-dom";
import { useCookies } from "react-cookie";
import { THIS_SEASON_PAGES, activePage } from "../../utils/seasons";

const PAGES = [...THIS_SEASON_PAGES, { key: 'history', label: 'History', to: '/history' }];

const Header = () => {
  const leagueInfo = useSelector((state) => state.leagueInfo)
  const { pathname } = useLocation();
	const [,, removeCookie] = useCookies(["league_id"]);

  const handleRemoveCookie = () => {
    removeCookie("league_id", {
      path: "/"
    });
  }

  return (
    <AppBar position="sticky" color="transparent">
      <Toolbar sx={{ gap: { xs: 1.5, sm: 3 }, minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
        <Box
          component={Link}
          to="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary', textDecoration: 'none', flexShrink: 0 }}
        >
          <SportsFootballIcon sx={{ color: 'primary.main' }} />
          <Typography
            noWrap
            sx={{
              // Hidden on small tablets, where the nav links need the room
              display: { xs: 'block', sm: 'none', md: 'block' },
              fontSize: { xs: 15, sm: 17 },
              fontWeight: 800,
              letterSpacing: '.18em',
            }}
          >
            FANTASY ALMANAC
          </Typography>
        </Box>

        {leagueInfo?.name &&
          <Box component="nav" sx={{ flexGrow: 1, display: { xs: 'none', sm: 'flex' }, gap: 0.5, overflowX: 'auto' }}>
            {PAGES.map((page) => (
              <Button
                key={page.key}
                component={NavLink}
                to={page.to}
                isActive={() => activePage(pathname, leagueInfo) === page.key}
                sx={{
                  color: 'text.secondary',
                  whiteSpace: 'nowrap',
                  px: 1.5,
                  '&:hover': { color: 'text.primary', backgroundColor: 'rgba(255,255,255,0.04)' },
                  '&.active': { color: 'text.primary', backgroundColor: 'rgba(94,230,160,0.12)' },
                }}
              >
                {page.label}
              </Button>
            ))}
          </Box>
        }

        {leagueInfo?.name &&
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', minWidth: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: { xs: 13, sm: 15 }, fontWeight: 600, maxWidth: { xs: 120, sm: 220 } }}>
                {leagueInfo.name}
              </Typography>
              <Button
                href="/"
                onClick={handleRemoveCookie}
                sx={{
                  display: { xs: 'none', md: 'block' },
                  color: 'text.secondary',
                  fontSize: 12,
                  fontWeight: 500,
                  p: 0,
                  minWidth: 0,
                  lineHeight: 1.4,
                  '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
                }}
              >
                Change league
              </Button>
            </Box>
            <Tooltip title="Feature suggestions">
              <IconButton
                component={Link}
                to="/suggestions"
                aria-label="Feature suggestions"
                sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.secondary' }}
              >
                <LightbulbOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      </Toolbar>
    </AppBar>
  );
}

export default Header;
