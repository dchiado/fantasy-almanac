import { useEffect, useState } from "react";
import { fetchApi } from "../api";

// Fetches `path` whenever it changes; pass null to skip. Responses for a stale path are dropped,
// so quickly changing filters can't show an older result over a newer one.
const useApi = (path) => {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    fetchApi(path)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => { cancelled = true; };
  }, [path]);

  return state;
};

export default useApi;
