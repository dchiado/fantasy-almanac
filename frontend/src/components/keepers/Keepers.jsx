import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Switch,
} from "@mui/material";
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";
import './Keepers.css';

const Keepers = ({ setError }) => {
  const leagueId = useSelector((state) => state.leagueInfo.id)

  const [keepers, setKeepers] = useState([]);
	const [loading, setLoading] = useState(true);

  const [isDesktop, _setDesktop] = useState(window.innerWidth > 900);

  const [maxYearsKept, setMaxYearsKept] = useState(2);
  const [earliestRoundKept, setEarliestRoundKept] = useState(null); // or a number like 5
  const [escalationRounds, setEscalationRounds] = useState(2);
  const [undraftedKeeperRound, setUndraftedKeeperRound] = useState(15);
  const [mustBeBeforeDeadline, setMustBeBeforeDeadline] = useState(true);

  useEffect(() => {
		if (keepers.length === 0 && leagueId) {
      setLoading(true);
			fetch(`${process.env.REACT_APP_API_URL}/keepers?leagueId=${leagueId}`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			)
			.then((res) =>
				res.json().then((data) => {
          console.log(data);
					setKeepers(data);
          setLoading(false);
				})
			)
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
        setLoading(false);
			});	
		}
	}, [leagueId, setError, keepers]);

  const getCalculatedKeeperRound = (player) => {
    if (player.draft_round === 'FA') {
      return undraftedKeeperRound;
    }
    return Math.max(1, player.draft_round - escalationRounds);
  };
  
  const getFilteredPlayers = (players) => {
    console.log('doing filtering');
    console.log(players);
    return players.filter((player) => {
      const calculatedRound = getCalculatedKeeperRound(player);
      console.log('calculatedRound: ' + calculatedRound);
      console.log('mustBeBeforeDeadline: ' + mustBeBeforeDeadline);
      console.log('player.acq_before_deadline: ' + player.acq_before_deadline);
  
      if (mustBeBeforeDeadline && !player.acq_before_deadline) return false;

      console.log('player.years_kept: ' + player.years_kept);
      console.log('maxYearsKept: ' + maxYearsKept);
      if (player.years_kept >= maxYearsKept) return false;
      if (earliestRoundKept !== null && calculatedRound < earliestRoundKept) return false;
  
      return true;
    });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const LabelWithTooltip = ({ label, tooltip }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{label}</span>
      <Tooltip title={tooltip} placement="top" arrow>
        <InfoOutlinedIcon fontSize="small" sx={{ color: 'lightgray' }} />
      </Tooltip>
    </div>
  );  

  return (
    <div>
      {loading ? <LoadingSpinner /> :
      <>
        <div className="keepers-filters" style={{ maxWidth: 700, margin: '1rem auto', textAlign: 'center' }}>
          <Typography
						variant="h6"
						sx={{
							fontWeight: 700,
							letterSpacing: '.25rem',
							mb: 2
						}}
						>
						Keeper Settings
					</Typography>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              justifyItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <TextField
              label={
                <LabelWithTooltip
                  label="Max Years Kept"
                  tooltip="Most times a player can be kept, excluding the first year owned, before returning to the draft pool"
                />
              }
              type="number"
              size="small"
              value={maxYearsKept}
              onChange={(e) => setMaxYearsKept(Number(e.target.value))}
              inputProps={{ min: 1 }}
              variant="filled"
              sx={{
                width: '100%',
                input: { color: 'white' },
                label: { color: 'lightgray' },
              }}
            />

            <TextField
              label={
                <LabelWithTooltip
                  label="Earliest Keeper Round"
                  tooltip="Earlier round a player can be kept in. E.g. enter 1 if you don't allow first round keepers."
                />
              }
              type="number"
              size="small"
              value={earliestRoundKept ?? 'None'}
              onChange={(e) => {
                const val = e.target.value;
                setEarliestRoundKept(val === 'None' ? null : Number(val));
              }}
              inputProps={{ min: 1, max: 15 }}
              placeholder="None"
              variant="filled"
              sx={{
                width: '100%',
                input: { color: 'white' },
                label: { color: 'lightgray' },
              }}
            />

            <TextField
              label={
                <LabelWithTooltip
                  label="Escalation Rounds"
                  tooltip="How many rounds earlier a player is kept than where they were drafted the previous season"
                />
              }
              type="number"
              size="small"
              value={escalationRounds}
              onChange={(e) => setEscalationRounds(Number(e.target.value))}
              inputProps={{ min: 0 }}
              variant="filled"
              sx={{
                width: '100%',
                input: { color: 'white' },
                label: { color: 'lightgray' },
              }}
            />

            <TextField
              label={
                <LabelWithTooltip
                  label="Undrafted Keeper Round"
                  tooltip="What round to assign undrafted (FA) players when kept"
                />
              }
              type="number"
              size="small"
              value={undraftedKeeperRound}
              onChange={(e) => setUndraftedKeeperRound(Number(e.target.value))}
              inputProps={{ min: 1, max: 15 }}
              variant="filled"
              sx={{
                width: '100%',
                input: { color: 'white' },
                label: { color: 'lightgray' },
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Switch
              checked={mustBeBeforeDeadline}
              onChange={(e) => setMustBeBeforeDeadline(e.target.checked)}
            />
            <Tooltip title="Only include players who were acquired before last year's trade deadline" placement="top" arrow>
              <Typography variant="body2" sx={{ cursor: 'help' }}>
                Must be Acquired Before Deadline
              </Typography>
            </Tooltip>
          </div>
        </div>

        <div className="keepers-container">
          {
            keepers.map((team, idx) => {
              return (
                <div key={`table-${idx}`}>
                  <Typography
                    variant="h6"
                    sx={{
                      display: 'flex',
                      fontWeight: 700,
                      letterSpacing: '.25rem',
                      ml: 5,
                      mb: 2
                    }}
                    >
                    {team.team_name}
                  </Typography>
                  <TableContainer
                    component={Paper}
                    className="table-container"
                    sx={{
                      width: { sm: '100%', md: 750 },
                      ml: 'auto',
                      mr: 'auto',
                      mb: 5 
                    }}>
                    <Table sx={{ fontSize: 14 }} size="small" aria-label="keepers table">
                      <TableHead>
                        <TableRow className="table-header">
                          <TableCell
                            align="center"
                            key="player"
                            sx={{ minWidth: 150, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                          >
                            Player
                          </TableCell>
                          <TableCell
                            align="center"
                            key="round"
                            sx={{ minWidth: 25, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                          >
                            Keeper Round
                          </TableCell>
                          {isDesktop &&
                            <>
                              <TableCell
                                align="center"
                                key="acquired"
                                sx={{ minWidth: 25, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                              >
                                Acquired
                              </TableCell>
                              <TableCell
                                align="center"
                                key="acqDate"
                                sx={{ minWidth: 50, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                              >
                                Acquired On
                              </TableCell>
                            </>
                          }
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {getFilteredPlayers(team.players).map((player, idx) => (
                          <TableRow
                            key={`row-${idx}`}
                            sx={{
                              backgroundColor: idx % 2 === 0 ? '#5B697F' : '#283447',
                              borderColor: idx % 2 === 0 ? '#5B697F' : '#283447',
                              color: 'white',
                            }}
                            >
                              <TableCell
                                align="center"
                                key='player'
                                sx={{
                                  fontSize: 'inherit',
                                  backgroundColor: 'inherit',
                                  color: 'inherit',
                                  borderColor: 'inherit',
                                  minWidth: 150
                                }}
                              >
                                {player.name}
                              </TableCell>
                              <TableCell
                                align="center"
                                key='round'
                                sx={{
                                  fontSize: 'inherit',
                                  backgroundColor: 'inherit',
                                  color: 'inherit',
                                  borderColor: 'inherit',
                                }}
                              >
                                {getCalculatedKeeperRound(player)}
                              </TableCell>
                              {isDesktop &&
                                <>
                                  <TableCell
                                    align="center"
                                    key='acq'
                                    sx={{
                                      fontSize: 'inherit',
                                      backgroundColor: 'inherit',
                                      color: 'inherit',
                                      borderColor: 'inherit',
                                    }}
                                  >
                                    {player.acq_type}
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    key='acqDate'
                                    sx={{
                                      fontSize: 'inherit',
                                      backgroundColor: 'inherit',
                                      color: 'inherit',
                                      borderColor: 'inherit',
                                    }}
                                  >
                                    {formatDate(player.acq_datetime)}
                                  </TableCell>
                                </>
                              }
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>
              )
            })
          }
        </div>
      </>
      }
    </div>
  )
}

export default Keepers;
