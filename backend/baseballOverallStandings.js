const year = '2025'
const urlBase = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/flb/seasons/${year}/segments/0/leagues`
const leagueIds = [
  3334,
  4575,
  9342,
  12812,
  12848,
  31036,
  31470,
  49488,
  81126
]

// could populate this with mScoreboard > settings > scoringSettings > scoringItems
const statMapping = [
  {
    stat: "runs",
    id: "20",
    highIsBetter: true
  },
  {
    stat: "hr",
    id: "5",
    highIsBetter: true
  },
  {
    stat: "rbi",
    id: "21",
    highIsBetter: true
  },
  {
    stat: "sb",
    id: "23",
    highIsBetter: true
  },
  {
    stat: "obp",
    id: "17",
    highIsBetter: true
  },
  {
    stat: "k",
    id: "48",
    highIsBetter: true
  },
  {
    stat: "w",
    id: "53",
    highIsBetter: true
  },
  {
    stat: "era",
    id: "47",
    highIsBetter: false
  },
  {
    stat: "whip",
    id: "41",
    highIsBetter: false
  },
  {
    stat: "svhd",
    id: "83",
    highIsBetter: true
  }  
]

// https://github.com/cwendt94/espn-api/blob/master/espn_api/baseball/constant.py

export const handler = async (event) => {
  let allTeams = [];

  // get all settings data
  const settingsPromises = [];
  for (const leagueId of leagueIds) {
    settingsPromises.push(fetch(`${urlBase}/${leagueId}?&view=mSettings`));
  }
  const settingsJsonPromises = settingsPromises.map((promise) => promise.then((resp) => resp.json()));
  const allSettings = await Promise.all(settingsJsonPromises);

  // get all scoreboard data
  const scoreboardPromises = [];
  for (const leagueId of leagueIds) {
    scoreboardPromises.push(fetch(`${urlBase}/${leagueId}?&view=mScoreboard`));
  }
  const scoreboardJsonPromises = scoreboardPromises.map((promise) => promise.then((resp) => resp.json()));
  const allScoreboards = await Promise.all(scoreboardJsonPromises);

  // get all team data
  const teamPromises = [];
  for (const leagueId of leagueIds) {
    teamPromises.push(fetch(`${urlBase}/${leagueId}?&view=mTeam`));
  }
  const teamJsonPromises = teamPromises.map((promise) => promise.then((resp) => resp.json()));
  const allTeamsData = await Promise.all(teamJsonPromises);
  
  // compile all data
  for (const leagueId of leagueIds) {
    const settings = allSettings.find((s) => s.id === leagueId);
    const scoreboard = allScoreboards.find((s) => s.id === leagueId);
    const teamsData = allTeamsData.find((t) => t.id === leagueId);

    const leagueName = settings.settings.name;
    const cleanedLeagueName = leagueName.replace(/^MLB Addicts\s*-?\s*/, "");

    scoreboard.teams.forEach((team) => {
      const teamInfo = teamsData.teams.find((t) => t.id === team.id);
      const owners = teamInfo.owners;
      const ownersNames = owners.map((o) => {
        const ownerInfo = teamsData.members.find((m) => m.id === o);
        return `${ownerInfo.firstName} ${ownerInfo.lastName}`;
      })
      const formattedOwners = ownersNames.join(', ');

      const teamDetails = scoreboard.schedule[0].teams.find((t) => t.teamId === team.id)
      const teamStats = teamDetails.cumulativeScore.scoreByStat;

      const outs = teamStats['34'].score;
      const inningsPitched = Math.floor(outs / 3) + (outs % 3) / 10;

      const info = {
        name: team.name,
        id: team.id,
        owner: formattedOwners,
        leagueName: cleanedLeagueName,
        leagueRank: team.rankCalculatedFinal,
        gamesPlayed: teamStats['81'].score,
        inningsPitched: inningsPitched,
        stats: {}
      }

      statMapping.forEach((statMapObj) => {
        const statId = statMapObj.id;
        const value = teamStats[statId].score;
        // TODO: not doing anything with this yet, when does it become true?
        const ineligible = teamStats[statId].ineligible;
        info.stats[statMapObj.stat] = { value: value, ineligible: ineligible }
      })

      allTeams.push(info);
    });
  }

  // updating "points" for each stat, relative to other teams
  statMapping.forEach((statObj) => {
    // get list of values
    const stat = statObj.stat;
    const allVals = allTeams.map(t => t.stats[stat].value).sort((a, b) => a - b);
    if (!statObj.highIsBetter) {
      allVals.reverse();
    }

    allTeams.forEach((team) => {
      const teamVal = team.stats[stat].value;

      // find all indexes of this stat total + 1
      const allIndexes = allVals.reduce((accu, current, idx) => {
        if (current === teamVal) {
          accu.push(idx + 1);
        }
        return accu;
      }, []);

      // get average of those indexes
      const average = allIndexes.reduce((a, b) => a + b) / allIndexes.length;

      // assign that number of points to the team
      team.stats[stat].points = average;
    })
  })

  // add totalPoints for each team
  allTeams.forEach((team) => {
    let totalPoints = 0;
    statMapping.forEach((statObj) => {
      totalPoints += team.stats[statObj.stat].points;
    })
    team.totalPoints = totalPoints;
  })

  // default sort by totalPoints
  allTeams.sort((a, b) => b.totalPoints - a.totalPoints);

  allTeams.forEach((team, i) => {
    team.overallRank = i + 1;
    team.id = i + 1;
  });

  return { teams: allTeams };
};
