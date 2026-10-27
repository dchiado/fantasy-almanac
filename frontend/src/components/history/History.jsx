import React from "react";
import { Box, Paper, Typography } from "@mui/material";
import TableChartIcon from '@mui/icons-material/TableChart';
import PeopleIcon from '@mui/icons-material/People';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import LockIcon from '@mui/icons-material/Lock';
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import PageLayout from "../ui/PageLayout";

const PAGES = [
  { to: '/standings', icon: TableChartIcon, title: 'All-time standings', body: "Every owner's record and titles, season by season" },
  { to: '/head-to-head', icon: PeopleIcon, title: 'Head-to-head', body: 'Any two owners against each other, all-time' },
  { to: '/records', icon: WorkspacePremiumIcon, title: 'Records', body: 'The best and worst weeks, seasons and blowouts' },
  // Keeper rules are Gridiron's own
  { to: '/keepers', icon: LockIcon, title: 'Keepers', body: 'Who each team can keep next season, and in which round', leagueId: '166975' },
];

// The league's all-time pages
const History = () => {
  const leagueInfo = useSelector((state) => state.leagueInfo);
  const pages = PAGES.filter((page) => !page.leagueId || page.leagueId === leagueInfo?.id);

  return (
    <PageLayout maxWidth={900} title="History" subtitle="The whole league, every season">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {pages.map(({ to, icon: Icon, title, body }) => (
          <Paper
            key={to}
            component={Link}
            to={to}
            variant="outlined"
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'flex-start',
              p: 2.5,
              color: 'text.primary',
              textDecoration: 'none',
              '&:hover': { bgcolor: 'var(--fa-surface-raised)' },
            }}
          >
            <Icon sx={{ color: 'primary.main', mt: 0.25 }} />
            <Box>
              <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
              <Typography variant="body2" color="text.secondary">{body}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </PageLayout>
  );
};

export default History;
