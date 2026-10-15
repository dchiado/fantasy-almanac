import React from "react";
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

// Rounded, bordered surface for forms, settings, and prose blocks
const SectionCard = ({ title, children, sx, ...rest }) => (
  <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, ...sx }} {...rest}>
    {title &&
      <Typography variant="overline" component="h2" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {title}
      </Typography>
    }
    {children}
  </Paper>
);

export default SectionCard;
