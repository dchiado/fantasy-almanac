// Simulated odds are never exactly certain, so 0 and 1 show as "<1%" and ">99%"
// unless the result is actually decided (e.g. after the last regular-season week)
export const formatPct = (p, certain = false) => {
  if (!certain && p < 0.005) return '<1%';
  if (!certain && p >= 0.995) return '>99%';
  return `${Math.round(p * 100)}%`;
};

export const formatRecord = ({ wins, losses, ties }) => `${wins}-${losses}${ties ? `-${ties}` : ''}`;

export const formatSigned = (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;
