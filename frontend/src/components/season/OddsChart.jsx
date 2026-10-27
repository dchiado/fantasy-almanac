import React, { useEffect, useRef, useState } from "react";
import Box from '@mui/material/Box';
import { formatPct } from "./format";

const HEIGHT = 260;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 40 };
const Y_TICKS = [0, 0.5, 1];

// Width of the element, kept current as it resizes
const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

/**
 * Every team's playoff odds by week, one line each. The selected team is
 * highlighted and labeled; the rest are context. The crosshair follows the
 * pointer (or arrow keys) and reports its week through onWeekChange, so the
 * table beside the chart can show every team's value for that week.
 *
 *   weeks: [{ week, teams: [{ team_id, playoff_pct }] }]
 *   names: team id -> display name
 */
const OddsChart = ({ weeks, names, selected, week, onWeekChange, finalWeek }) => {
  const [ref, width] = useWidth();
  const [hoverWeek, setHoverWeek] = useState(null);

  const lastWeek = weeks[weeks.length - 1].week;
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (w) => MARGIN.left + (lastWeek ? (w / lastWeek) * plotWidth : 0);
  const y = (p) => MARGIN.top + (1 - p) * plotHeight;

  const series = {};
  weeks.forEach((w) => w.teams.forEach((t) => {
    (series[t.team_id] = series[t.team_id] || []).push([w.week, t.playoff_pct]);
  }));
  const path = (points) => points.map(([w, p], i) => `${i ? 'L' : 'M'}${x(w).toFixed(1)},${y(p).toFixed(1)}`).join('');

  // Label every week if there's room, otherwise every second or fourth
  const step = plotWidth / Math.max(1, lastWeek) >= 28 ? 1 : plotWidth / Math.max(1, lastWeek) >= 14 ? 2 : 4;
  const xTicks = weeks.map((w) => w.week).filter((w) => w % step === 0 || w === lastWeek);

  const weekAt = (clientX) => {
    const box = ref.current.getBoundingClientRect();
    const ratio = (clientX - box.left - MARGIN.left) / Math.max(1, plotWidth);
    return Math.min(lastWeek, Math.max(0, Math.round(ratio * lastWeek)));
  };

  const shownWeek = hoverWeek ?? week;
  const selectedPoints = series[selected] || [];
  const end = selectedPoints[selectedPoints.length - 1];
  const at = selectedPoints.find(([w]) => w === shownWeek);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') onWeekChange(Math.max(0, week - 1));
    else if (e.key === 'ArrowRight') onWeekChange(Math.min(lastWeek, week + 1));
    else return;
    e.preventDefault();
  };

  return (
    <Box ref={ref} sx={{ position: 'relative', width: '100%' }}>
      {width > 0 &&
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Playoff odds by week. ${names[selected] ?? ''} highlighted. Use the left and right arrow keys to change the week shown in the table.`}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerMove={(e) => setHoverWeek(weekAt(e.clientX))}
          onPointerLeave={() => setHoverWeek(null)}
          onPointerDown={(e) => onWeekChange(weekAt(e.clientX))}
          style={{ display: 'block', touchAction: 'pan-y', outline: 'none', cursor: 'crosshair' }}
        >
          {Y_TICKS.map((p) => (
            <g key={p}>
              <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(p)} y2={y(p)} stroke="var(--fa-border)" strokeWidth={1} />
              <text x={MARGIN.left - 8} y={y(p)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--fa-text-muted)">
                {p * 100}%
              </text>
            </g>
          ))}
          {xTicks.map((w) => (
            <text key={w} x={x(w)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--fa-text-muted)">
              {w === 0 ? 'Pre' : w}
            </text>
          ))}

          {Object.entries(series).filter(([id]) => Number(id) !== selected).map(([id, points]) => (
            <path key={id} d={path(points)} fill="none" stroke="var(--fa-chart-context)" strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
          ))}

          <line x1={x(shownWeek)} x2={x(shownWeek)} y1={MARGIN.top} y2={MARGIN.top + plotHeight}
                stroke="var(--fa-text-muted)" strokeWidth={1} />

          {selectedPoints.length > 0 &&
            <>
              <path d={path(selectedPoints)} fill="none" stroke="var(--fa-chart-highlight)" strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round" />
              {at && <circle cx={x(at[0])} cy={y(at[1])} r={4} fill="var(--fa-chart-highlight)" stroke="var(--fa-surface)" strokeWidth={2} />}
              {end && end[0] !== shownWeek &&
                <circle cx={x(end[0])} cy={y(end[1])} r={4} fill="var(--fa-chart-highlight)" stroke="var(--fa-surface)" strokeWidth={2} />}
              {end &&
                <text
                  x={x(end[0])}
                  y={y(end[1]) + (end[1] > 0.85 ? 18 : -10)}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--fa-text)"
                  stroke="var(--fa-surface)"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {(names[selected] ?? '').slice(0, 22)} {formatPct(end[1], end[0] === finalWeek)}
                </text>
              }
            </>
          }
        </svg>
      }
      {width === 0 && <Box sx={{ height: HEIGHT }} />}
    </Box>
  );
};

export default OddsChart;
