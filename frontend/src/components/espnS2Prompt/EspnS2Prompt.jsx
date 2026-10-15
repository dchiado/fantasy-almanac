import React, { useState } from "react";
import { Typography, TextField, Paper, Button } from "@mui/material";
import './EspnS2Prompt.css';

const EspnS2Prompt = ({ title, intro, outro, submitLabel, onSubmit, initialValue = "", busy, footer }) => {
  const [espnS2, setEspnS2] = useState(initialValue);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (espnS2) onSubmit(espnS2.trim());
  };

  return (
    <Paper className="espn-s2-prompt" variant="outlined">
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Typography paragraph>{intro}</Typography>
      <Typography paragraph component="div">
        Here's how to find it:
        <ol>
          <li>Login to <a href="https://fantasy.espn.com" target="_blank" rel="noreferrer">ESPN Fantasy</a></li>
          <li>Press <code>F12</code> or right-click → Inspect</li>
          <li>Go to the <strong>Application</strong> tab → Storage → Cookies → <code>espn.com</code></li>
          <li>Copy the value of <code>espn_s2</code></li>
        </ol>
        {outro}
      </Typography>
      <form className="espn-s2-prompt-input-row" onSubmit={handleSubmit}>
        <TextField
          id="outlined-espn-cookie"
          label="espn_s2 Cookie"
          fullWidth
          value={espnS2}
          onChange={(e) => setEspnS2(e.target.value)}
          disabled={!!busy}
        />
        {busy || (
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!espnS2}
            sx={{ width: '150px' }}
          >
            {submitLabel}
          </Button>
        )}
      </form>
      {footer}
    </Paper>
  );
};

export default EspnS2Prompt;
