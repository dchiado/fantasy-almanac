import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import Header from "./components/header/Header";
import { BrowserRouter, Route, Switch} from 'react-router-dom';

import Suggestions from "./components/suggestions/Suggestions";
import LeagueInfo from "./components/leagueInfo/LeagueInfo";
import CookieWarning from "./components/cookieWarning/CookieWarning";
import EspnS2Prompt from "./components/espnS2Prompt/EspnS2Prompt";
import Standings from "./components/standings/Standings";
import HeadToHead from "./components/headToHead/HeadToHead";
import PowerRankings from "./components/powerRankings/PowerRankings";
import Records from "./components/records/Records";
import FooterMobile from "./components/footerMobile/FooterMobile";
import LeagueInfoMobile from "./components/leagueInfoMobile/LeagueInfoMobile";
import MobileDataLinks from "./components/mobileDataLinks/MobileDataLinks";
import Keepers from "./components/keepers/Keepers";
import BaseballOverall from "./components/baseballOverall/BaseballOverall";
import LoadingState from "./components/ui/LoadingState";

import { useDispatch } from "react-redux";
import { useCookies } from "react-cookie";
import { updateLeagueInfo } from './features/leagueInfo/leagueInfoSlice'
import { ESPN_S2_KEY } from './api'
import { Alert, Button, useMediaQuery } from "@mui/material";
import { Stack } from "@mui/system";

const App = () => {
  const path = window.location.pathname;

	const dispatch = useDispatch()
	const [cookies, setCookie] = useCookies(["league_id"]);
  const [error, setError] = useState();
	const [leagueId, setLeagueId] = useState();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [showHeaderFooter, setShowHeaderFooter] = useState(true);
  const [espnS2, setEspnS2] = useState(() => localStorage.getItem(ESPN_S2_KEY) || "");
  const [needsPrivateAuth, setNeedsPrivateAuth] = useState(false);
  const [isCached, setIsCached] = useState(null);
  const [loading, setLoading] = useState(false);

	useEffect(() => {
    setShowHeaderFooter(path !== '/mlb-addicts');
  }, [path])

	const fetchLeagueInfo = useCallback((id, s2) => {
		if (id) {
      setLoading(true);

      const url = s2
        ? `${process.env.REACT_APP_API_URL}/info?leagueId=${id}&espnS2=${encodeURIComponent(s2)}`
        : `${process.env.REACT_APP_API_URL}/info?leagueId=${id}`;

			fetch(url, {
					crossDomain: true,
					method: 'GET',
					headers: { 'Content-Type':'application/json' },
				}
			).then((res) =>
				res.json().then((data) => {
					if (data.error) {
						console.log(data.error)
						if (data.error.type === 'AUTH_LEAGUE_NOT_VISIBLE') {
							if (s2) {
								// espn_s2 is opaque, so a rejection is the only signal it expired
								localStorage.removeItem(ESPN_S2_KEY);
								setEspnS2("");
								setError('ESPN didn\'t accept that espn_s2 cookie. It may have expired, or that account isn\'t in this league. Grab a fresh one and try again.');
							}
							setNeedsPrivateAuth(true);
						} else {
							let msg = `Error: ${data.error.message}`;
							if (data.error.type === 'GENERAL_NOT_FOUND') {
								msg += '. Make sure you\'ve entered the correct League ID.'
							}
							setError(msg);
						}
					} else {
						setNeedsPrivateAuth(false);
						setError();
						if (s2) {
							localStorage.setItem(ESPN_S2_KEY, s2);
						}
						if (!cookies?.league_id) {
							setCookie("league_id", id, {
								path: "/"
							});
						}

						dispatch(updateLeagueInfo({
							id,
							name: data.name,
							established: data.established,
							teams: data.teams,
							year: data.year,
							week: data.week
						}));

            setIsCached(data.cached);
					}
				})
			)
			.catch((error) => {
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			})
      .finally(() => {
        setLoading(false);
      });
		}
	}, [cookies?.league_id, dispatch, setCookie]);

	const onLeagueInfoSubmit = (event) => {
		event.preventDefault();
		fetchLeagueInfo(leagueId, espnS2);
	}

	const onPrivateAuthSubmit = (s2) => {
		setEspnS2(s2);
		fetchLeagueInfo(leagueId, s2);
	}

	const onPrivateAuthCancel = () => {
		setNeedsPrivateAuth(false);
		setLeagueId(undefined);
		setError();
	}

	const onLeagueIdChange = (event) => {
		const id = event.target.value;
		setLeagueId(id);
	}

	const autoLoaded = useRef(false);
	useEffect(() => {
		if (autoLoaded.current) return;
		autoLoaded.current = true;

    const subdomain = window.location.host.split('.')[0];
		let id;
		if (cookies?.league_id !== undefined) {
			id = cookies.league_id;
		} else if (subdomain === 'gridiron') {
      id = '166975';
    } else if (Number.isInteger(Number(subdomain))) {
      id = String(subdomain);
    }

		if (id) {
			setLeagueId(id);
			fetchLeagueInfo(id, espnS2);
		}
	}, [cookies, espnS2, fetchLeagueInfo])

	const privateAuthPrompt = (
		<EspnS2Prompt
			title="This league is private"
			intro={
				<>
					League <strong>{leagueId}</strong> isn't viewable to the public, so ESPN needs your{' '}
					<code>espn_s2</code> cookie to prove you're in it.
				</>
			}
			outro="Paste it below. We'll remember it in this browser so you won't have to do this again until it expires."
			submitLabel="Unlock"
			onSubmit={onPrivateAuthSubmit}
			footer={
				<Button className="espn-s2-prompt-link" variant="text" onClick={onPrivateAuthCancel}>
					Wrong league? Enter a different ID
				</Button>
			}
		/>
	);

	return (
		<div className={`App${isMobile && showHeaderFooter ? ' mobile' : ''}`}>
			<BrowserRouter>
				{showHeaderFooter ? <Header /> : <div></div>}
				<Switch>
					<Route exact path="/">
            {loading ? <LoadingState variant="card" /> :
            needsPrivateAuth ? privateAuthPrompt : (
              <LeagueInfo
                onLeagueIdChange={onLeagueIdChange}
                onLeagueInfoSubmit={onLeagueInfoSubmit}
              />
            )}
            {isCached === false &&
              <CookieWarning
                initialEspnS2={espnS2}
                onCookieSubmit={setEspnS2}
                onCacheComplete={() => setIsCached(true)}
              />
            }
					</Route>
					<Route path="/league-info-mobile">
						{needsPrivateAuth ? privateAuthPrompt : (
							<LeagueInfoMobile
								onLeagueIdChange={onLeagueIdChange}
								onLeagueInfoSubmit={onLeagueInfoSubmit}
							/>
						)}
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
          <Route path="/keepers">
            <Keepers
              setError={setError}
            />
          </Route>
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
				{showHeaderFooter && isMobile && <FooterMobile />}
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
