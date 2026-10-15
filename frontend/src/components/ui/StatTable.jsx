import React from "react";
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

// Hides a column below a breakpoint, e.g. hideBelow: 'sm' keeps phones uncluttered
const hideBelowSx = (bp) => bp ? { display: { xs: 'none', [bp]: 'table-cell' } } : {};

/**
 * Shared data table.
 *
 * columns: [{
 *   key, label,
 *   align?: 'left' | 'center' | 'right'   (defaults to 'right' when numeric, else 'left')
 *   numeric?: bool,
 *   sticky?: bool        pin to the left edge while scrolling sideways (first column only)
 *   wrap?: bool          allow text to wrap (default: no wrapping)
 *   minWidth?: number,
 *   hideBelow?: 'sm' | 'md' | 'lg',
 *   render?: (row, rowIdx) => node,
 *   cellSx?: (row, rowIdx) => sx,
 * }]
 */
const StatTable = ({ columns, rows, getRowKey = (_, idx) => idx, ariaLabel, maxWidth = '100%', stickyHeader = false, maxHeight }) => {
  const alignFor = (col) => col.align ?? (col.numeric ? 'right' : 'left');

  const stickySx = {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    // Edge shadow so scrolled columns visibly slide under the pinned one
    boxShadow: 'inset -1px 0 0 var(--fa-border)',
  };

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ width: '100%', maxWidth, mx: 'auto', maxHeight, WebkitOverflowScrolling: 'touch' }}
    >
      <Table size="small" stickyHeader={stickyHeader} aria-label={ariaLabel} sx={{ fontSize: 14 }}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                align={alignFor(col)}
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'text.secondary',
                  backgroundColor: 'var(--fa-surface-raised)',
                  py: 1.25,
                  minWidth: col.minWidth,
                  ...(col.sticky ? { ...stickySx, zIndex: 3 } : {}),
                  ...hideBelowSx(col.hideBelow),
                }}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody
          sx={{
            // Solid row colors (not transparent) so the sticky column covers what scrolls beneath it
            '& tr:nth-of-type(odd) > *': { backgroundColor: 'var(--fa-row)' },
            '& tr:nth-of-type(even) > *': { backgroundColor: 'var(--fa-row-alt)' },
            '& tr:hover > *': { backgroundColor: 'var(--fa-surface-raised)' },
            '& tr:last-of-type > *': { borderBottom: 0 },
          }}
        >
          {rows.map((row, rowIdx) => (
            <TableRow key={getRowKey(row, rowIdx)}>
              {columns.map((col, colIdx) => (
                <TableCell
                  key={col.key}
                  component={colIdx === 0 ? 'th' : 'td'}
                  scope={colIdx === 0 ? 'row' : undefined}
                  align={alignFor(col)}
                  sx={{
                    fontSize: 'inherit',
                    py: 1,
                    whiteSpace: col.wrap ? 'normal' : 'nowrap',
                    minWidth: col.minWidth,
                    ...(col.sticky ? stickySx : {}),
                    ...hideBelowSx(col.hideBelow),
                    ...(col.cellSx ? col.cellSx(row, rowIdx) : {}),
                  }}
                >
                  {col.render ? col.render(row, rowIdx) : row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default StatTable;
