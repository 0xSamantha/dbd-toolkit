(function (root) {
  const outcomes = ['Escaped', 'Sacrificed', 'Killed', 'Disconnected'];
  const killerOutcomes = ['0 kills', '1 kill', '2 kills', '3 kills', '4 kills', 'Disconnected'];
  function summarize(run) {
    const roster = Object.fromEntries(run.roster.map(name => [name, 'Available']));
    let escapes = 0, deaths = 0, streak = 0, kills = 0;
    const killer = run.role === "killer";
    for (const match of run.matches) {
      const killCount = killer ? killerOutcomes.indexOf(match.outcome) : -1;
      if (killer && killCount >= 0 && killCount <= 4) kills += killCount;
      if (killer && killCount === 2) {
        streak = 0;
        continue;
      }
      if (killer ? killCount === 3 || killCount === 4 : match.outcome === 'Escaped') {
        escapes++;
        streak++;
        if (run.rules.clear) roster[match.character] = killer ? 'Cleared' : 'Escaped';
      } else if (match.outcome !== 'Disconnected' || run.rules.disconnect) {
        deaths++;
        streak = 0;
        if (run.rules.eliminate) roster[match.character] = 'Eliminated';
      }
    }
    if (roster[run.active] === 'Available') roster[run.active] = 'Playing';
    const remaining = Object.values(roster).filter(state => state === 'Available' || state === 'Playing').length;
    return { roster, escapes, deaths, streak, remaining, latest: run.matches.at(-1), ...(killer ? { kills } : {}) };
  }
  const model = { outcomes, killerOutcomes, summarize };
  if (typeof module === 'object') module.exports = model;
  else root.Hardcore = model;
})(globalThis);
