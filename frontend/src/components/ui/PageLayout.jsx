import React from "react";
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

// Common page frame: consistent gutters, a left-aligned title row, and an optional actions slot
// that drops below the title on phones.
const PageLayout = ({ title, subtitle, actions, maxWidth = 1200, children }) => (
  <Box
    component="main"
    sx={{
      width: '100%',
      maxWidth,
      mx: 'auto',
      px: { xs: 2, sm: 3 },
      py: { xs: 3, sm: 4 },
      boxSizing: 'border-box',
      textAlign: 'left',
    }}
  >
    {(title || actions) &&
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'flex-end' },
          justifyContent: 'space-between',
          gap: 2,
          mb: { xs: 2.5, sm: 3 },
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {title && <Typography variant="h4" component="h1">{title}</Typography>}
          {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
        </Box>
        {actions}
      </Box>
    }
    {children}
  </Box>
);

export default PageLayout;
