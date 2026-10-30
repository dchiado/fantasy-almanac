import React, { useCallback, useEffect, useRef, useState } from "react";
import { Redirect, Route, Switch, useHistory, useParams, useRouteMatch } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useCookies } from "react-cookie";
import { Button } from "@mui/material";

import LeagueInfo from "../leagueInfo/LeagueInfo";
import LeagueDashboard from "../leagueInfo/LeagueDashboard";
import CookieWarning from "../cookieWarning/CookieWarning";
import EspnS2Prompt from "../espnS2Prompt/EspnS2Prompt";
import Standings from "../standings/Standings";
import HeadToHead from "../headToHead/HeadToHead";
import PowerRankings from "../powerRankings/PowerRankings";
import Records from "../records/Records";
import LeagueInfoMobile from "../leagueInfoMobile/LeagueInfoMobile";
import History from "../history/History";
import Keepers from "../keepers/Keepers";
import RecapPage from "../recap/RecapPage";
import SeasonPage from "../season/SeasonPage";
import CurrentSeasonPage from "../season/CurrentSeasonPage";
import LoadingState from "../ui/LoadingState";

import { clearLeagueInfo, updateLeagueInfo } from "../../features/leagueInfo/leagueInfoSlice";
import { ESPN_S2_KEY } from "../../api";
import { leaguePath } from "../../utils/seasons";

// Loads the league named in the URL (/league/{id}), asking for espn_s2 if it's
// private, then shows its pages. Nothing under it renders until leagueInfo is
// this league, so a page never fetches with another league's ID.
const League = ({ setError }) => {
  const { leagueId } = useParams();
  const { path } = useRouteMatch();
  const history = useHistory();
  const dispatch = useDispatch();
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const [, setCookie, removeCookie] = useCookies(["league_id"]);
  const [espnS2, setEspnS2] = useState(() => localStorage.getItem(ESPN_S2_KEY) || "");
  const [needsPrivateAuth, setNeedsPrivateAuth] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isCached, setIsCached] = useState(null);

  // Only the latest request counts, so switching leagues quickly can't load the wrong one
  const latestRequest = useRef(0);

  const fetchLeagueInfo = useCallback((s2) => {
    const request = ++latestRequest.current;
    setNeedsPrivateAuth(false);
    setFailed(false);
    setIsCached(null);
    dispatch(clearLeagueInfo());

    const url = s2
      ? `${process.env.REACT_APP_API_URL}/info?leagueId=${leagueId}&espnS2=${encodeURIComponent(s2)}`
      : `${process.env.REACT_APP_API_URL}/info?leagueId=${leagueId}`;

    fetch(url, {
        crossDomain: true,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    ).then((res) =>
      res.json().then((data) => {
        if (request !== latestRequest.current) {
          return;
        }

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
            setFailed(true);
          }
        } else if (!res.ok) {
          // A crashed lambda has no league in its response, so don't load one
          setError(`Error retrieving data: ${data.message}`);
          setFailed(true);
        } else {
          setError();
          if (s2) {
            localStorage.setItem(ESPN_S2_KEY, s2);
          }

          // The last league opened is where / goes next time
          setCookie("league_id", leagueId, {
            path: "/"
          });

          dispatch(updateLeagueInfo({
            id: leagueId,
            name: data.name,
            established: data.established,
            teams: data.teams,
            year: data.year,
            week: data.week,
            phase: data.phase,
            regularSeasonWeeks: data.regular_season_weeks,
            regularSeasonWeeksLeft: data.regular_season_weeks_left,
            hasPlayoffs: data.has_playoffs
          }));

          setIsCached(data.cached);
        }
      })
    )
    .catch((error) => {
      if (request !== latestRequest.current) {
        return;
      }

      console.error(error);
      setError(`Error retrieving data: ${error.message}`);
      setFailed(true);
    });
  }, [dispatch, leagueId, setCookie, setError]);

  const loaded = leagueInfo.id === leagueId;

  // Only when the URL names a league other than the one loaded
  useEffect(() => {
    if (!loaded) {
      fetchLeagueInfo(espnS2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const onPrivateAuthSubmit = (s2) => {
    setEspnS2(s2);
    fetchLeagueInfo(s2);
  }

  const onPrivateAuthCancel = () => {
    setError();
    removeCookie("league_id", {
      path: "/"
    });
    history.push("/");
  }

  if (needsPrivateAuth) {
    return (
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
  }

  // A league ID ESPN doesn't know: ask for another
  if (failed) {
    return <LeagueInfo />;
  }

  if (!loaded) {
    return <LoadingState variant="card" />;
  }

  return (
    <Switch>
      <Route exact path={path}>
        <LeagueDashboard leagueInfo={leagueInfo} />
        {isCached === false &&
          <CookieWarning
            initialEspnS2={espnS2}
            onCookieSubmit={setEspnS2}
            onCacheComplete={() => setIsCached(true)}
          />
        }
      </Route>
      <Route path={`${path}/league-info-mobile`}>
        <LeagueInfoMobile />
      </Route>
      <Route path={`${path}/all-time-standings`}>
        <Standings setError={setError} />
      </Route>
      <Route path={`${path}/head-to-head`}>
        <HeadToHead setError={setError} />
      </Route>
      <Route path={`${path}/power-rankings`}>
        <PowerRankings setError={setError} />
      </Route>
      <Route path={`${path}/playoffs`}>
        <CurrentSeasonPage section="playoffs" setError={setError} />
      </Route>
      <Route path={`${path}/standings`}>
        <CurrentSeasonPage section="standings" setError={setError} />
      </Route>
      <Route path={`${path}/recap`}>
        <RecapPage />
      </Route>
      {/* The current season's standings page was briefly called Luck */}
      <Route path={`${path}/luck`}>
        <Redirect to={leaguePath(leagueId, '/standings')} />
      </Route>
      <Route path={`${path}/seasons/:year/weeks/:week`}>
        <RecapPage />
      </Route>
      <Route path={`${path}/seasons/:year?`}>
        <SeasonPage setError={setError} />
      </Route>
      <Route path={`${path}/records`}>
        <Records setError={setError} />
      </Route>
      <Route path={`${path}/keepers`}>
        <Keepers setError={setError} />
      </Route>
      <Route path={`${path}/history`}>
        <History />
      </Route>
      {/* The old mobile "Data" menu, now History */}
      <Route path={`${path}/mobile-data-links`}>
        <Redirect to={leaguePath(leagueId, '/history')} />
      </Route>
      <Route>
        <Redirect to={leaguePath(leagueId)} />
      </Route>
    </Switch>
  );
}

export default League;
