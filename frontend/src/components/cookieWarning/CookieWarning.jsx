import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Typography, TextField, Paper, Button, LinearProgress, Box } from "@mui/material";
import './CookieWarning.css';

const CookieWarning = ({ onCookieSubmit, onCacheComplete }) => {
  const [espnS2, setEspnS2] = useState("");
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

  const handleChange = (e) => {
    setEspnS2(e.target.value);
    onCookieSubmit(e.target.value);
  };

  const handleSend = async () => {
    if (!espnS2 || !leagueInfo.id) return;

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
    <Paper className="cookie-warning" elevation={3} style={{ padding: 20, margin: "20px auto", maxWidth: 600 }}>
      <Typography variant="h6" gutterBottom>
        ⚠️ Heads-up, time traveler
      </Typography>
      <Typography paragraph>
        Your league was established in <strong>{leagueInfo.established}</strong>, but ESPN's API won't serve
        data from before 2018 without your <code>espn_s2</code> cookie. Fun, I know.
      </Typography>
      <Typography paragraph>
        Here's how to find it:
        <ol>
          <li>Login to <a href="https://fantasy.espn.com" target="_blank" rel="noreferrer">ESPN Fantasy</a></li>
          <li>Press <code>F12</code> or right-click → Inspect</li>
          <li>Go to the <strong>Application</strong> tab → Storage → Cookies → <code>espn.com</code></li>
          <li>Copy the value of <code>espn_s2</code></li>
        </ol>
        Paste it below and we'll use it to retrieve your league's ancient history. We will store the data so
        you won't ever have to do this again.
      </Typography>
      <div className="cookie-warning-input-row">
        <TextField
          id="outlined-espn-cookie"
          label="espn_s2 Cookie"
          fullWidth
          value={espnS2}
          variant="filled"
          onChange={handleChange}
          disabled={loading}
          sx={{
            input: { color: 'white' },
            label: { color: 'lightgray' },
          }}
        />
        {loading ? (
          <Box sx={{ mb: 2, width: '100%' }}>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5, mt: 1 }} />
          </Box>
        ) :
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          disabled={loading || !espnS2}
          sx={{ width: '150px' }}
        >
          {loading ? "Working..." : "Send It"}
        </Button>
      }

      </div>
    </Paper>
  );
};

export default CookieWarning;
