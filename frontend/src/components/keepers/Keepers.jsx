import {
  Box,
  Chip,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Paper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import LoadingState from "../ui/LoadingState";
import PageLayout from "../ui/PageLayout";
import SectionCard from "../ui/SectionCard";
import { fetchApi } from "../../api";

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const Keepers = ({ setError }) => {
  const leagueId = useSelector((state) => state.leagueInfo.id)

  const [keepers, setKeepers] = useState([]);
	const [loading, setLoading] = useState(true);

  const [maxYearsKept, setMaxYearsKept] = useState(2);
  const [earliestRoundKept, setEarliestRoundKept] = useState(null); // or a number like 5
  const [escalationRounds, setEscalationRounds] = useState(2);
  const [undraftedKeeperRound, setUndraftedKeeperRound] = useState(15);
  const [mustBeBeforeDeadline, setMustBeBeforeDeadline] = useState(true);

  useEffect(() => {
		if (keepers.length === 0 && leagueId) {
      setLoading(true);
			fetchApi(`/keepers?leagueId=${leagueId}`)
			.then((data) => {
				setKeepers(data);
        setLoading(false);
			})
			.catch((error) => {
				setLoading(false);
				console.error(error);
				setError(`Error retrieving data: ${error.message}`);
			});	
		}
	}, [leagueId, setError, keepers]);

  const getCalculatedKeeperRound = (player) => {
    if (player.draft_round === 'FA') {
      return undraftedKeeperRound;
    }
    return Math.max(1, player.draft_round - escalationRounds);
  };
  
  const getFilteredPlayers = (players) => {
    return players.filter((player) => {
      const calculatedRound = getCalculatedKeeperRound(player);
      if (mustBeBeforeDeadline && !player.acq_before_deadline) return false;
      if (player.years_kept >= maxYearsKept) return false;
      if (earliestRoundKept !== null && calculatedRound < earliestRoundKept) return false;
      return true;
    });
  };

  // Explanations sit under each field instead of in hover tooltips, which phones can't trigger
  const settingFields = [
    {
      id: 'max-years-kept',
      label: 'Max years kept',
      helperText: 'Times a player can be kept, excluding the first year owned',
      value: maxYearsKept,
      onChange: (e) => setMaxYearsKept(Number(e.target.value)),
      inputProps: { min: 1 },
    },
    {
      id: 'earliest-keeper-round',
      label: 'Earliest keeper round',
      helperText: "E.g. 2 if first-round keepers aren't allowed. Blank for no limit.",
      value: earliestRoundKept ?? '',
      placeholder: 'None',
      onChange: (e) => setEarliestRoundKept(e.target.value === '' ? null : Number(e.target.value)),
      inputProps: { min: 1, max: 15 },
    },
    {
      id: 'escalation-rounds',
      label: 'Escalation rounds',
      helperText: 'Rounds earlier a player is kept than where they were drafted',
      value: escalationRounds,
      onChange: (e) => setEscalationRounds(Number(e.target.value)),
      inputProps: { min: 0 },
    },
    {
      id: 'undrafted-keeper-round',
      label: 'Undrafted keeper round',
      helperText: 'Round assigned to undrafted (FA) players when kept',
      value: undraftedKeeperRound,
      onChange: (e) => setUndraftedKeeperRound(Number(e.target.value)),
      inputProps: { min: 1, max: 15 },
    },
  ];

  if (loading) {
    return <LoadingState rows={8} />;
  }

  return (
    <PageLayout maxWidth={1100} title="Keepers" subtitle="Who each team can keep under your league's rules.">
      <SectionCard title="Keeper settings" sx={{ mb: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          {settingFields.map(({ id, ...field }) => (
            <TextField
              key={id}
              id={id}
              type="number"
              InputLabelProps={{ shrink: true }}
              {...field}
              inputProps={{ ...field.inputProps, inputMode: 'numeric' }}
            />
          ))}
        </Box>
        <FormControlLabel
          sx={{ mt: 2, alignItems: 'flex-start' }}
          control={
            <Switch
              checked={mustBeBeforeDeadline}
              onChange={(e) => setMustBeBeforeDeadline(e.target.checked)}
            />
          }
          label={
            <Box sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Must be acquired before deadline</Typography>
              <Typography variant="caption" color="text.secondary">
                Only include players acquired before last year's trade deadline
              </Typography>
            </Box>
          }
        />
      </SectionCard>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        {keepers.map((team) => {
          const eligible = getFilteredPlayers(team.players)
            .map((player) => ({ ...player, keeperRound: getCalculatedKeeperRound(player) }))
            .sort((a, b) => a.keeperRound - b.keeperRound);

          return (
            <Paper component="section" variant="outlined" key={team.team_name} sx={{ overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1.5, bgcolor: 'var(--fa-surface-raised)' }}>
                <Typography component="h2" sx={{ fontWeight: 700, minWidth: 0 }} noWrap>{team.team_name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  {eligible.length} eligible
                </Typography>
              </Box>
              {eligible.length === 0
                ? <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>No eligible keepers under these settings.</Typography>
                : <List dense disablePadding>
                    {eligible.map((player, idx) => (
                      <ListItem key={`${player.name}-${idx}`} divider={idx < eligible.length - 1} sx={{ px: 2, py: 0.75 }}>
                        <ListItemText
                          primary={player.name}
                          primaryTypographyProps={{ fontWeight: 600 }}
                          secondary={`${player.acq_type} · ${formatDate(player.acq_datetime)}`}
                        />
                        <Chip
                          label={`Rd ${player.keeperRound}`}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', ml: 1 }}
                        />
                      </ListItem>
                    ))}
                  </List>
              }
            </Paper>
          );
        })}
      </Box>
    </PageLayout>
  )
}

export default Keepers;
