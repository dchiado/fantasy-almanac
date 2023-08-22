import React, { useState } from "react";
import { useSelector } from 'react-redux'
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { useCookies } from "react-cookie";
import { ClickAwayListener, IconButton, Tooltip, Typography } from "@mui/material";
import HelpIcon from '@mui/icons-material/Help';
import "./LeagueInfo.css";

const LeagueInfo = ({ onLeagueIdChange, onLeagueInfoSubmit }) => {
	const leagueInfo = useSelector((state) => state.leagueInfo)
	const [cookies,,] = useCookies(["league_id"]);
	const [open, setOpen] = useState(false);

	const handleTooltipClose = () => {
    setOpen(false);
  };

  const handleTooltipOpen = () => {
    setOpen(true);
  };

	let helpText = 'Your league ID can be found in the URL of your league page as the number after "leagueId=". '
	helpText += 'Only ESPN leagues are supported and the setting "Make League Viewable to Public" must be set to "Yes".'

	return (
		<div className="wrapper">
			{cookies?.league_id && leagueInfo.name ? 
				<div>
          <Typography
            variant="h4"
            sx={{
              display: 'flex',
							alignContent: 'center',
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.25rem',
            }}
            >
            {leagueInfo.name}
          </Typography>

					<div className="league-info-subtitles">
						<div className="left">
							<Typography variant="caption" sx={{ mt: 3, display: 'flex', letterSpacing: '.25rem' }}>
								Established
							</Typography>
							<Typography variant="h6" sx={{ display: 'flex', letterSpacing: '.25rem' }}>
								{leagueInfo.established}
							</Typography>
						</div>
						<div className="right">
							<Typography variant="caption" sx={{ mt: 3, display: 'flex', letterSpacing: '.25rem' }}>
								Teams
							</Typography>
							<Typography variant="h6" sx={{ display: 'flex', letterSpacing: '.25rem' }}>
								{leagueInfo.teams}
							</Typography>
						</div>
					</div>
				</div>
				:
				<form onSubmit={onLeagueInfoSubmit} className="row-form">
					<ClickAwayListener onClickAway={handleTooltipClose}>
            <div>
							<Tooltip
                PopperProps={{
                  disablePortal: true,
                }}
                onClose={handleTooltipClose}
                open={open}
                disableFocusListener
                disableHoverListener
                disableTouchListener
                title={<div style={{ fontSize: 14 }}>{helpText}</div>}
              >
								<IconButton onClick={handleTooltipOpen}>
									<HelpIcon sx={{ color: 'white' }} />
								</IconButton>
							</Tooltip>
						</div>
          </ClickAwayListener>

					<TextField
						id="outlined-name"
						label="League ID"
						variant="filled"
						onChange={onLeagueIdChange}
						onKeyPress={(event) => {
							if (!/[0-9]/.test(event.key)) {
								event.preventDefault();
							}
						}}			
						sx={{
							input: { color: 'white' },
							label: { color: 'white' },
						}}
					/>
					<Button
						variant="contained"
						type="submit"
						value="Submit"
					>
						Submit
					</Button>
				</form>
			}
		</div>
	);
}

export default LeagueInfo;
