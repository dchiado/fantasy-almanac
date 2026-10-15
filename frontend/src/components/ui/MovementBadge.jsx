import React from "react";
import Box from '@mui/material/Box';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

// Places gained/lost since last week: green ▲2, red ▼1, muted dash when unchanged
const MovementBadge = ({ movement }) => {
  if (movement === null || movement === undefined) return null;

  const up = movement > 0;
  const down = movement < 0;
  const label = up ? `Up ${movement} since last week` : down ? `Down ${-movement} since last week` : 'No change since last week';

  return (
    <Box
      component="span"
      title={label}
      aria-label={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: 28,
        fontSize: 12,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        color: up ? 'success.main' : down ? 'error.main' : 'text.disabled',
      }}
    >
      {up && <ArrowDropUpIcon sx={{ fontSize: 20, mx: -0.5 }} />}
      {down && <ArrowDropDownIcon sx={{ fontSize: 20, mx: -0.5 }} />}
      {up || down ? Math.abs(movement) : '–'}
    </Box>
  );
}

export default MovementBadge;
