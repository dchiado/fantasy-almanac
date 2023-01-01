import {
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import React, { useState } from "react";
import { useEffect } from "react";
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";
import './Records.css';

const Records = () => {
  const [loading, setLoading] = useState(false);

  const [bestWorst, setBestWorst] = useState('');
  const [object, setObject] = useState('');
  const [scope, setScope] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [numRecords, setNumRecords] = useState('');
  const [includePlayoffs, setIncludePlayoffs] = useState(false);

  const [records, setRecords] = useState([]);
  const [headers, setHeaders] = useState([]);

  useEffect(() => {
    if (records.length > 0 && headers.length > 0) {
      setLoading(false)
    }
  }, [records, headers]);

  const handleSubmit = (event) => {
    event.preventDefault();
    setLoading(true);

    let endpoint;
    if (object === 'week') {
      endpoint = '/individual-weeks';
    } else if (object === 'season') {
      endpoint = '/individual-seasons'
    } else {
      endpoint = '/matchups'
    }

    let params = `?bestworst=${bestWorst}&playoffs=${includePlayoffs}&count=${numRecords}`;
    if (scope === 'years') {
      params += `&startyear=${startYear}&endyear=${endYear}`
    }

    fetch(endpoint + params).then((res) =>
      res.json().then((data) => {
        if (object === 'week') {
          setHeaders(['Year', 'Week', 'Team', 'Score']);
          setRecords(data.map((d) => [d.year, d.week, d.team_name, d.score]));
        } else if (object === 'season') {
          setHeaders(['Year', 'Team', 'Average', 'League Average', 'Std Dev']);
          setRecords(data.map((d) => [d.year, d.team_name, d.average, d.league_average, d.std_dev_away]));
        } else {
          setHeaders(['Year', 'Week', 'Win Margin', 'Winner', 'Loser']);
          setRecords(data.map((d) => [d.year, d.week, d.difference, d.winner, d.loser]));
        }
      })
    )
  }

  const handleSelectBestWorst = (event) => {
    setBestWorst(event.target.value);
  }

  const handleSelectObject = (event) => {
    setObject(event.target.value);
  }

  const handleSelectScope = (event) => {
    setScope(event.target.value);
  }

  const handleStartYearChange = (event) => {
    setStartYear(event.target.value);
  }

  const handleEndYearChange = (event) => {
    setEndYear(event.target.value);
  }

  const handleNumRecordsChange = (event) => {
    const newVal = parseInt(event.target.value) || 0;
		setNumRecords(newVal);
  }

  const handleIncludePlayoffs = (event) => {
    setIncludePlayoffs(event.target.checked);
  }

  const handleNewQuery = () => {
    setHeaders([]);
    setRecords([]);
  }

  return (
    <div className="records-content">
      {loading && <LoadingSpinner />}

      {(records.length === 0 && !loading) &&
        <form onSubmit={handleSubmit} className="head-to-head-form">
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel id='best-worst-label' sx={{ color: 'lightgray' }}>Best/Worst</InputLabel>
            <Select
              labelId='best-worst-label'
              id='select-best-worst'
              value={bestWorst}
              label='Best/Worst'
              name='bestworst'
              onChange={handleSelectBestWorst}
              required
              sx={{ color: 'white' }}
              >
              <MenuItem value="best" key="best">Best</MenuItem>
              <MenuItem value="worst" key="worst">Worst</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel id='object-label' sx={{ color: 'lightgray' }}>Season/Week/Matchup</InputLabel>
            <Select
              labelId='object-label'
              id='select-object'
              value={object}
              label='Season/Week/Matchup'
              name='object'
              onChange={handleSelectObject}
              required
              sx={{ color: 'white' }}
              >
              <MenuItem value="season" key="season">Seasons</MenuItem>
              <MenuItem value="week" key="week">Weeks</MenuItem>
              <MenuItem value="matchup" key="matchup">Matchups</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel id='scope-label' sx={{ color: 'lightgray' }}>When?</InputLabel>
            <Select
              labelId='scope-label'
              id='select-scope'
              value={scope}
              label='When?'
              name='scope'
              onChange={handleSelectScope}
              required
              sx={{ color: 'white' }}
              >
              <MenuItem value="alltime" key="alltime">All-Time</MenuItem>
              <MenuItem value="years" key="years">Specific year range</MenuItem>
            </Select>
          </FormControl>

          {scope === 'years' &&
            <div className="row-input">
              <FormControl>
                <TextField
                  id="outlined-from"
                  label="From"
                  value={startYear || ''}
                  variant="filled"
                  onChange={handleStartYearChange}
                  sx={{
                    input: { color: 'white' },
                    label: { color: 'lightgray' },
                  }}
                  />
              </FormControl>
              <FormControl>
                <TextField
                  id="outlined-to"
                  label="To"
                  value={endYear || ''}
                  variant="filled"
                  onChange={handleEndYearChange}
                  sx={{
                    input: { color: 'white' },
                    label: { color: 'lightgray' },
                  }}
                  />
              </FormControl>
            </div>
          }

          <FormControl>
            <TextField
              id="outlined-num-records"
              label="Number of records"
              value={numRecords}
              variant="filled"
              onChange={handleNumRecordsChange}
              sx={{
                input: { color: 'white' },
                label: { color: 'lightgray' },
              }}
              />
          </FormControl>

          {(object === 'week' || object === 'matchup') &&
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch onChange={handleIncludePlayoffs}/>
                }
                label="Include Playoffs"
                />
            </FormGroup>
          }

          <Button variant="contained" type="submit" value="Submit">Submit</Button>
        </form>
      }

      {records.length > 0 &&
        <div className="table-container">
          {records.length > 0 &&
            <div className="table-button-wrapper">
              <Typography
                variant="h6"
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  fontWeight: 700,
                  letterSpacing: '.25rem',
                }}
                >
                The {numRecords} {bestWorst} {object}s {scope === 'alltime' ? 'of all-time' : `from ${startYear} to ${endYear}`} 
              </Typography>

              <TableContainer component={Paper}>
                <Table sx={{ fontSize: 13 }} size="small" aria-label="records table">
                  <TableHead>
                    <TableRow
                      sx={{
                        backgroundColor: 'gray',
                        color: 'white',
                        fontWeight: 700
                      }
                    }>
                      <TableCell
                        align="center"
                        key='rank'
                        sx={{ fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                      >
                        #
                      </TableCell>

                      {headers.map((h) => (
                        <TableCell
                          align="center"
                          key={h}
                          sx={{ minWidth: 25, fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit' }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {records.map((row, idx) => (
                      <TableRow
                        key={`row-${idx}`}
                        sx={{
                          '&:last-child td, &:last-child th': { border: 0 },
                          backgroundColor: idx % 2 === 0 ? 'lightgray' : 'white'
                        }}
                        >
                          <TableCell
                            align="center"
                            key='rank'
                            sx={{
                              fontSize: 'inherit',
                              background: 'inherit',
                              border: 'inherit',
                              borderColor: 'inherit'
                            }}
                          >
                            {idx + 1}
                          </TableCell>

                          {row.map((cell) => (
                            <TableCell
                              align="center"
                              key={cell}
                              sx={{
                                minWidth: 25,
                                fontSize: 'inherit',
                                background: 'inherit',
                                border: 'inherit',
                                borderColor: 'inherit'
                              }}
                            >
                              {cell}
                            </TableCell>
                            )
                          )}
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button variant="contained" onClick={handleNewQuery} sx={{ marginBottom: '20px' }}>New Query</Button>
            </div>
          }
        </div>
      }
    </div>
  )
}

export default Records;