import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";
import './Keepers.css';

const Keepers = ({ setError }) => {
  const leagueId = useSelector((state) => state.leagueInfo.id)

  const [keepers, setKeepers] = useState([]);
	const [loading, setLoading] = useState(false);

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

  return (
    <div>
      {loading ? <LoadingSpinner /> :
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
                      mb: 2
                    }}
                    >
                    {team.team_name}
                  </Typography>
                  <TableContainer component={Paper} className="table-container" sx={{ width: 650, mb: 5 }}>
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
                            key="acquired"
                            sx={{ minWidth: 25, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                          >
                            Acquired
                          </TableCell>
                          <TableCell
                            align="center"
                            key="round"
                            sx={{ minWidth: 25, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                          >
                            Keeper Round
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {team.players.map((player, idx) => (
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
                                key='round'
                                sx={{
                                  fontSize: 'inherit',
                                  backgroundColor: 'inherit',
                                  color: 'inherit',
                                  borderColor: 'inherit',
                                }}
                              >
                                {player.keeper_round}
                              </TableCell>
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
      }
    </div>
  )
}

export default Keepers;
