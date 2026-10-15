import React from "react";
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';

const TableSkeleton = ({ rows }) => (
  <Box sx={{ border: '1px solid var(--fa-border)', borderRadius: 3, overflow: 'hidden' }}>
    <Skeleton variant="rectangular" height={40} sx={{ bgcolor: 'var(--fa-surface-raised)' }} />
    {Array.from({ length: rows }).map((_, i) => (
      <Box key={i} sx={{ display: 'flex', gap: 2, px: 2, py: 1.25, bgcolor: i % 2 ? 'var(--fa-row-alt)' : 'var(--fa-row)' }}>
        <Skeleton width="30%" />
        <Skeleton width="15%" sx={{ ml: 'auto' }} />
        <Skeleton width="15%" />
      </Box>
    ))}
  </Box>
);

/**
 * Placeholder shaped like the content it stands in for, so the page doesn't jump when data lands.
 *   variant="table"   heading + table rows (default)
 *   variant="card"    heading + a text block
 *   variant="spinner" centered spinner, for layouts too irregular to sketch
 * Pass `inline` when rendering inside a page that already provides the gutters.
 */
const LoadingState = ({ variant = 'table', rows = 8, title = true, inline = false }) => {
  if (variant === 'spinner') {
    return (
      <Box role="status" aria-label="Loading" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '50vh' }}>
        <CircularProgress size={44} thickness={4} />
      </Box>
    );
  }

  return (
    <Box
      role="status"
      aria-label="Loading"
      sx={inline
        ? { width: '100%' }
        : { width: '100%', maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 }, boxSizing: 'border-box' }
      }
    >
      {title && <Skeleton variant="text" sx={{ fontSize: '2rem', width: { xs: '70%', sm: 280 }, mb: 3 }} />}
      {variant === 'card'
        ? <Skeleton variant="rounded" height={180} sx={{ borderRadius: 3 }} />
        : <TableSkeleton rows={rows} />
      }
    </Box>
  );
}

export default LoadingState;
