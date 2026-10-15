export const ESPN_S2_KEY = "espn_s2";

export const fetchApi = async (path) => {
  const espnS2 = localStorage.getItem(ESPN_S2_KEY);
  const auth = espnS2 ? `${path.includes('?') ? '&' : '?'}espnS2=${encodeURIComponent(espnS2)}` : '';

  const res = await fetch(`${process.env.REACT_APP_API_URL}${path}${auth}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();

  if (data?.error) {
    if (data.error.type === 'AUTH_LEAGUE_NOT_VISIBLE') {
      localStorage.removeItem(ESPN_S2_KEY);
      throw new Error("ESPN didn't accept your espn_s2 cookie, it may have expired. Reload the page to enter a fresh one.");
    }
    throw new Error(data.error.message);
  }
  if (!res.ok) {
    throw new Error(data?.message || `Request failed with status ${res.status}`);
  }
  return data;
};
