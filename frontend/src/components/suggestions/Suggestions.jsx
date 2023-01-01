import { Button, TextField } from "@mui/material";
import React from "react";
import './Suggestions.css';

const Suggestions = () => {
  return (
    <form 
      action="https://formspree.io/f/mzbyyanw"
      method="POST"
      className="column-form"
      >
      <TextField
        id="email"
        label="Your email"
        variant="filled"
        name="email"
        sx={{
          input: { color: 'white' },
          label: { color: 'white' },
        }}
      />
      <TextField
        id="message"
        label="Your message"
        variant="filled"
        name="message"
        multiline
        rows={4}
        sx={{
          textarea: { color: 'white' },
          label: { color: 'white' },
        }}
      />
      <Button
        variant="contained"
        type="submit"
        value="Submit"
      >
        Send It
      </Button>
    </form>
  )
}

export default Suggestions;