import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import Footer from "./components/footer/Footer";
import Header from "./components/header/Header";
import { BrowserRouter, Route, Switch} from 'react-router-dom';

import Suggestions from "./components/suggestions/Suggestions";
import LeagueInfo from "./components/leagueInfo/LeagueInfo";
import Standings from "./components/standings/Standings";
import HeadToHead from "./components/headToHead/HeadToHead";
import PowerRankings from "./components/powerRankings/PowerRankings";
import Records from "./components/records/Records";
import FooterMobile from "./components/footerMobile/FooterMobile";
import LeagueInfoMobile from "./components/leagueInfoMobile/LeagueInfoMobile";
import MobileDataLinks from "./components/mobileDataLinks/MobileDataLinks";
import Keepers from "./components/keepers/Keepers";
import BaseballOverall from "./components/baseballOverall/BaseballOverall";
import { useDispatch, useSelector } from "react-redux";
import { useCookies } from "react-cookie";
import { updateLeagueInfo } from './features/leagueInfo/leagueInfoSlice'
import { Alert } from "@mui/material";
import { Stack } from "@mui/system";

const App = () => {
  const path = window.location.pathname;
	const width = window.innerWidth;
  const breakpoint = 620;

	const dispatch = useDispatch()
	const leagueInfo = useSelector((state) => state.leagueInfo.id)
	const [cookies, setCookie] = useCookies(["league_id"]);
  const [error, setError] = useState();
	const [leagueId, setLeagueId] = useState();
  const [showHeader, setShowHeader] = useState(true);

	useEffect(() => {
    setShowHeader(width > breakpoint && path !== '/mlb-addicts');
  }, [path, width, breakpoint])

	const fetchLeagueInfo = useCallback(() => {
		if (leagueId) {
			fetch(
				`${process.env.REACT_APP_API_URL}/info?leagueId=${leagueId}`,
				{
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			).then((res) =>
				res.json().then((data) => {
					if (data.error) {
						console.log(data.error)
						let msg = `Error: ${data.error.message}`;
						if (data.error.type === 'AUTH_LEAGUE_NOT_VISIBLE') {
							msg += ' Make sure the league is Viewable to Public.'
						} else if (data.error.type === 'GENERAL_NOT_FOUND') {
							msg += '. Make sure you\'ve entered the correct League ID.'
						}
						setError(msg);
					} else {
						if (!cookies?.league_id) {
							setCookie("league_id", leagueId, {
								path: "/"
							});
						}
				
						dispatch(updateLeagueInfo({
							id: leagueId,
							name: data.name,
							established: data.established,
							teams: data.teams,
							year: data.year,
							week: data.week,
						}));
					}
				})
			)
			.catch((error) => {
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});
		}
	}, [cookies?.league_id, dispatch, leagueId, setCookie]);

	const onLeagueInfoSubmit = (event) => {
		event.preventDefault();
		fetchLeagueInfo();
	}

	const onLeagueIdChange = (event) => {
		const id = event.target.value;
		setLeagueId(id);
	}

	useEffect(() => {
		if (cookies?.league_id !== undefined && !leagueInfo?.id && !error) {
			setLeagueId(cookies.league_id);
			fetchLeagueInfo();
		} else if (window.location.host.split('.')[0] === 'gridiron' && !error) {
      setLeagueId('166975');
      fetchLeagueInfo();
    }
	}, [cookies, dispatch, leagueInfo, error, fetchLeagueInfo])

	return (
		<div className="App">
			<BrowserRouter>
				{showHeader ? <Header /> : <div></div>}
				<Switch>
					<Route exact path="/">
						<LeagueInfo
							onLeagueIdChange={onLeagueIdChange}
							onLeagueInfoSubmit={onLeagueInfoSubmit}
						/>
					</Route>
					<Route path="/league-info-mobile">
						<LeagueInfoMobile
							onLeagueIdChange={onLeagueIdChange}
							onLeagueInfoSubmit={onLeagueInfoSubmit}
						/>
					</Route>
					<Route path="/standings">
						<Standings
							setError={setError}
						/>
					</Route>
					<Route path="/head-to-head">
						<HeadToHead
							setError={setError}
						/>
					</Route>
					<Route path="/power-rankings">
						<PowerRankings
							setError={setError}
						/>
					</Route>
					<Route path="/records">
						<Records
							setError={setError}
						/>
					</Route>
					{leagueId === '166975' && // The Gridiron league only
						<Route path="/keepers">
							<Keepers
								setError={setError}
              />
						</Route>
					}
          <Route path="/mlb-addicts">
						<BaseballOverall
							setError={setError}
						/>
					</Route>
					<Route path="/mobile-data-links">
						<MobileDataLinks />
					</Route>
					<Route path="/suggestions">
						<Suggestions />
					</Route>
				</Switch>
			</BrowserRouter>
			{error &&
				<Stack spacing={2} sx={{ position: 'fixed', top: 100 }}>
					<Alert onClose={() => setError()} severity="error">{error}</Alert>
				</Stack>
			}
      {showHeader &&
        <>
          {width > breakpoint ? <Footer /> : <FooterMobile />}
        </>
      }
		</div>
	);
}

export default App;
