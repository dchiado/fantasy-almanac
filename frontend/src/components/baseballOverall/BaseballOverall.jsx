import React, { useState, useEffect } from "react";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import LoadingSpinner from "../loadingSpinner/LoadingSpinner";

import './BaseballOverall.css';

const stats = [
  {
    key: 'runs',
    label: 'R'
  },
  {
    key: 'hr',
    label: 'HR'
  },
  {
    key: 'rbi',
    label: 'RBI'
  },
  {
    key: 'sb',
    label: 'SB'
  },
  {
    key: 'obp',
    label: 'OBP'
  },
  {
    key: 'k',
    label: 'K'
  },
  {
    key: 'w',
    label: 'W'
  },
  {
    key: 'era',
    label: 'ERA'
  },
  {
    key: 'whip',
    label: 'WHIP'
  },
  {
    key: 'svhd',
    label: 'SVHD'
  },
]

const BaseballOverall = ({ setError }) => {
	const [standingsData, setStandingsData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [display, setDisplay] = useState('points');
  const [sorting, setSorting] = useState({ field: 'totalPoints', ascending: true })


	useEffect(() => {
		if (standingsData.length === 0) {
			fetch(`${process.env.REACT_APP_API_URL}/baseball/overall-standings`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			)
			.then((res) =>
        res.json().then((data) => {
          if (standingsData.length === 0) {
            setStandingsData([]);
            setStandingsData(data.teams);
            setLoading(false);
          }
        })
			)
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});	
		}
	}, [standingsData, setError]);

  const handleDisplayChange = (event) => {
    setDisplay(event.target.value);
  };

  const applySorting = (field, ascending) => {
    setSorting({ field: field, ascending: ascending });
  }

  useEffect(() => {
    if (standingsData.length === 0 || !sorting.field) {
      return;
    }

    const standings = [...standingsData];

    const sortedStandings = standings.sort((a, b) => {
      let aVal;
      let bVal;

      if (a.stats.hasOwnProperty(sorting.field)) {
        aVal = a.stats[sorting.field].value;
        bVal = b.stats[sorting.field].value;
      } else {
        aVal = a[sorting.field];
        bVal = b[sorting.field];
      }

      return bVal - aVal;
    });

    setStandingsData(sorting.ascending ? sortedStandings : sortedStandings.reverse());
  }, [sorting]);

  const Arrows = ({ column }) => {
    const sorted = column === sorting.field;
    const up = sorting.ascending;

    const upClass = `up-arrow${sorted && up ? ' up-black' : ''}`;
    const downClass = `down-arrow${sorted && !up ? ' down-black' : ''}`;

    return (
      <div className="baseball-right">
        <div className={upClass}></div>
        <div className={downClass}></div>
      </div>
    );
  }

	return (
		<div className="baseball-container">
      {loading ? 
        <div className="baseball-spinner"><LoadingSpinner /></div> :
        <>
          {Object.keys(standingsData).length > 0 &&
            <>
              <div className="baseball-radio-group">
                <FormControl>
                  <RadioGroup
                    aria-labelledby="display-radio-buttons-group"
                    name="display-radio-buttons-group"
                    value={display}
                    onChange={handleDisplayChange}
                    row
                  >
                    <FormControlLabel value="points" control={<Radio />} label="Points" />
                    <FormControlLabel value="stats" control={<Radio />} label="Stats" />
                  </RadioGroup>
                </FormControl>
              </div>

              <div className="baseball-table-container">
                <table className="baseball-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>
                        Team
                      </th>
                      <th className="baseball-clip">
                        Owner
                      </th>
                      <th className="baseball-clip">
                        League
                      </th>
                      <th className="baseball-clickable" onClick={() => applySorting('overallRank', !sorting.ascending)}>
                        <div className="baseball-left">
                          Rank
                        </div>
                        <Arrows column="overallRank" />
                      </th>
                      <th className="baseball-clickable" onClick={() => applySorting('totalPoints', !sorting.ascending)}>
                        <div className="baseball-left">
                          Points
                        </div>
                        <Arrows column="totalPoints" />
                      </th>
                      {stats.map((stat, idx) => (
                        <>
                          <th
                            key={`${stat.key}-header`}
                            className="baseball-clickable"
                            onClick={() => applySorting(stat.key, !sorting.ascending)}
                          >
                            <div className="baseball-left">
                              {stat.label}
                            </div>
                            <Arrows column={stat.key} />
                          </th>
                          {idx === 4 && <td className="baseball-gray" key="header-empty-column"></td>}
                        </>
                      ))}
                      <th></th>
                      <th className="baseball-clickable" onClick={() => applySorting('gamesPlayed', !sorting.ascending)}>
                        <div className="baseball-left">
                          GP
                        </div>
                        <Arrows column="gamesPlayed" />
                      </th>
                      <th className="baseball-clickable" onClick={() => applySorting('inningsPitched', !sorting.ascending)}>
                        <div className="baseball-left">
                          IP
                        </div>
                        <Arrows column="inningsPitched" />
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {standingsData.map((row, idx) => {
                      return (
                        <tr key={`${row.name}-row`} >
                          <td className="baseball-row-number">
                            {idx + 1}
                          </td>
                          <td>
                            {row.name}
                          </td>
                          <td className="baseball-clip">
                            {row.owner}
                          </td>
                          <td className="baseball-clip">
                            {row.leagueName}
                          </td>
                          <td>
                            {row.overallRank}
                          </td>
                          <td className="baseball-gray">
                            {row.totalPoints}
                          </td>
                          {stats.map((stat, idx) => {
                            let displayVal;
                            let hoverVal;
                            if (display === 'stats') {
                              const value = row.stats[stat.key].value.toString();
                              hoverVal = value.length > 5 ? value : null;
                              displayVal = value.substring(0, 5);
                            } else {
                              displayVal = row.stats[stat.key].points.toString();
                            }
                            return (
                              <>
                                <td key={`${row.name}-${stat.key}`} title={hoverVal}>
                                  {displayVal}
                                </td>
                                {idx === 4  && <td className="baseball-gray" key={`${row.name}-empty-column`}></td>}
                              </>
                            )
                          })}
                          <td className="baseball-gray"></td>
                          <td>
                            {row.gamesPlayed}
                          </td>
                          <td>
                            {row.inningsPitched}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          }
        </>
      }
		</div>
	);
}

export default BaseballOverall;
