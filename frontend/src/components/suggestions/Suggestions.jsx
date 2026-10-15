import { Button, TextField, Typography } from "@mui/material";
import React from "react";
import './Suggestions.css';

const Suggestions = () => {
  return (
    <form
      action="https://formspree.io/f/mzbyyanw"
      method="POST"
      className="column-form"
      >
      <div>
        <Typography variant="h5">Feature suggestions</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Got an idea for the almanac? Send it over.
        </Typography>
      </div>
      <TextField
        id="email"
        label="Your email"
        type="email"
        name="email"
        fullWidth
      />
      <TextField
        id="message"
        label="Your message"
        name="message"
        multiline
        rows={4}
        fullWidth
      />
      <Button
        variant="contained"
        size="large"
        type="submit"
        value="Submit"
      >
        Send It
      </Button>
    </form>
  )
}

export default Suggestions;
