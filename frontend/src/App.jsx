import React, { useEffect, useState } from "react";
import "./App.css";
import Header from "./components/header/Header";
import { BrowserRouter, Redirect, Route, Switch} from 'react-router-dom';

import Suggestions from "./components/suggestions/Suggestions";
import LeagueInfo from "./components/leagueInfo/LeagueInfo";
import League from "./components/league/League";
import FooterMobile from "./components/footerMobile/FooterMobile";
import BaseballOverall from "./components/baseballOverall/BaseballOverall";

import { useSelector } from "react-redux";
import { useCookies } from "react-cookie";
import { leaguePath } from './utils/seasons'
import { Alert, useMediaQuery } from "@mui/material";
import { Stack } from "@mui/system";

const GRIDIRON_LEAGUE_ID = '166975';

// Pages from before every league page moved under /league/{id}, kept for old
// bookmarks and shared links
const LEGACY_PATHS = [
	'/league-info-mobile',
	'/all-time-standings',
	'/head-to-head',
	'/power-rankings',
	'/playoffs',
	'/standings',
	'/luck',
	'/seasons',
	'/records',
	'/keepers',
	'/history',
	'/mobile-data-links',
];

// The league / opens: the last one opened in this browser, else Gridiron on its subdomain
const defaultLeagueId = (cookies) => {
	if (cookies?.league_id !== undefined) {
		return cookies.league_id;
	}

	if (window.location.host.split('.')[0] === 'gridiron') {
		return GRIDIRON_LEAGUE_ID;
	}

	return undefined;
}

const App = () => {
  const path = window.location.pathname;

	const [cookies] = useCookies(["league_id"]);
  const [error, setError] = useState();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);
	const leagueLoaded = useSelector((state) => !!state.leagueInfo.name);
	const defaultLeague = defaultLeagueId(cookies);

	useEffect(() => {
    setShowHeaderFooter(path !== '/mlb-addicts');
  }, [path])

	return (
		<div className={`App${isMobile && showHeaderFooter ? ' mobile' : ''}`}>
			<BrowserRouter>
				{showHeaderFooter ? <Header /> : <div></div>}
				<Switch>
					<Route exact path="/">
						{defaultLeague ? <Redirect to={leaguePath(defaultLeague)} /> : <LeagueInfo />}
					</Route>
					<Route path="/league/:leagueId(\d+)">
						<League setError={setError} />
					</Route>
          <Route path="/mlb-addicts">
						<BaseballOverall
							setError={setError}
						/>
					</Route>
					<Route path="/suggestions">
						<Suggestions />
					</Route>
					{/* Short links: /123 opens league 123 */}
					<Route
						path="/:leagueId(\d+)"
						render={({ match }) => <Redirect to={leaguePath(match.params.leagueId)} />}
					/>
					<Route
						path={LEGACY_PATHS}
						render={({ location }) => (
							<Redirect to={defaultLeague ? leaguePath(defaultLeague, location.pathname + location.search) : '/'} />
						)}
					/>
				</Switch>
				{showHeaderFooter && isMobile && leagueLoaded && <FooterMobile />}
			</BrowserRouter>
			{error &&
				<Stack spacing={2} sx={{ position: 'fixed', top: 100 }}>
					<Alert onClose={() => setError()} severity="error">{error}</Alert>
				</Stack>
			}
		</div>
	);
}

export default App;
