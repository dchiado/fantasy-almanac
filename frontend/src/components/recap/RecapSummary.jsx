import React, { useEffect, useState } from "react";
import { Box, Skeleton, Typography } from "@mui/material";
import { fetchApi } from "../../api";
import SectionCard from "../ui/SectionCard";

// A summary still being written is asked for again this often, this many times
const RETRY_MS = 8000;
const RETRIES = 4;

/**
 * The recap's summary (summary and summary_status in GET /recap) as
 * { summary, status }. One still being written is asked for again a few
 * times, without reloading the recap; status is "late" if it still isn't
 * ready after that.
 * path: the /recap API path the recap came from.
 */
export const useRecapSummary = (path, recap) => {
  const [late, setLate] = useState(null);

  useEffect(() => {
    setLate(null);

    if (!path || recap?.summary_status !== 'pending') {
      return undefined;
    }

    let cancelled = false;
    let timer;
    let tries = 0;

    const check = () => {
      tries += 1;
      fetchApi(path)
        .then((data) => {
          if (cancelled) {
            return;
          }

          if (data.summary_status !== 'pending') {
            setLate({ summary: data.summary ?? null, status: data.summary_status });
          } else if (tries < RETRIES) {
            timer = setTimeout(check, RETRY_MS);
          } else {
            setLate({ summary: null, status: 'late' });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLate({ summary: null, status: 'failed' }); // the recap is already showing; just no summary
          }
        });
    };
    timer = setTimeout(check, RETRY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [path, recap]);

  if (late) {
    return late;
  }
  return { summary: recap?.summary ?? null, status: recap?.summary_status ?? null };
};

const SummarySkeleton = () => (
  <Box aria-label="Writing this week's summary">
    {[100, 92, 96, 70].map((width, i) => (
      <Skeleton key={i} variant="text" width={`${width}%`} />
    ))}
  </Box>
);

// The week's story in a paragraph, above the recap's items: shown
// once ready, as a skeleton while it's being written, and not at all if it
// failed or the league doesn't get summaries
const RecapSummary = ({ summary, status, sx }) => {
  let content;
  if (summary) {
    content = <Typography variant="body2">{summary}</Typography>;
  } else if (status === 'pending') {
    content = <SummarySkeleton />;
  } else if (status === 'late') {
    content = <Typography variant="body2" color="text.secondary">Still being written. Check back in a minute.</Typography>;
  } else {
    return null;
  }

  return (
    <SectionCard title="What you missed" sx={sx}>
      {content}
    </SectionCard>
  );
};

export default RecapSummary;
