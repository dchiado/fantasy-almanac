import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { LinearProgress, Box } from "@mui/material";
import EspnS2Prompt from "../espnS2Prompt/EspnS2Prompt";

const CookieWarning = ({ initialEspnS2, onCookieSubmit, onCacheComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const leagueInfo = useSelector((state) => state.leagueInfo);

  useEffect(() => {
    let interval;

    const pollStatus = async () => {
      try {
        const res = await fetch(
          `${process.env.REACT_APP_API_URL}/cache/status?leagueId=${leagueInfo.id}&startYear=${leagueInfo.established}`
        );
        const data = await res.json();

        setProgress(data.percentComplete || 0);

        if (data.done) {
          setLoading(false);
          clearInterval(interval);
          onCacheComplete();
        }
      } catch (err) {
        console.error("Polling error:", err);
        setLoading(false);
        clearInterval(interval);
      }
    };

    if (loading) {
      interval = setInterval(pollStatus, 2000);
    }

    return () => clearInterval(interval);
  }, [loading, leagueInfo.id]);

  if (!leagueInfo.established || leagueInfo.established >= 2018) return null;

  const handleSend = async (espnS2) => {
    if (!leagueInfo.id) return;

    onCookieSubmit(espnS2);
    setLoading(true);
    setProgress(0);

    try {
      await fetch(
        `${process.env.REACT_APP_API_URL}/cache?leagueId=${leagueInfo.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startYear: leagueInfo.established,
            espn_s2: espnS2
          })
        }
      );
    } catch (error) {
      console.error("Error sending espn_s2:", error);
      setLoading(false);
    }
  };

  return (
    <EspnS2Prompt
      title="⚠️ Heads-up, time traveler"
      intro={
        <>
          Your league was established in <strong>{leagueInfo.established}</strong>, but ESPN's API won't serve
          data from before 2018 without your <code>espn_s2</code> cookie. Fun, I know.
        </>
      }
      outro="Paste it below and we'll use it to retrieve your league's ancient history. We will store the data so you won't ever have to do this again."
      submitLabel="Send It"
      initialValue={initialEspnS2}
      onSubmit={handleSend}
      busy={loading && (
        <Box sx={{ mb: 2, width: '100%' }}>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5, mt: 1 }} />
        </Box>
      )}
    />
  );
};

export default CookieWarning;
