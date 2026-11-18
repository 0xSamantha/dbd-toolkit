(function (root) {
  const outcomes = ['Escaped', 'Sacrificed', 'Killed', 'Disconnected'];
  function summarize(run) {
    const roster = Object.fromEntries(run.roster.map(name => [name, 'Available']));
    let escapes = 0, deaths = 0, streak = 0;
    for (const match of run.matches) {
      if (match.outcome === 'Escaped') {
        escapes++;
        streak++;
        if (run.rules.clear) roster[match.character] = 'Escaped';
      } else if (match.outcome !== 'Disconnected' || run.rules.disconnect) {
        deaths++;
        streak = 0;
        if (run.rules.eliminate) roster[match.character] = 'Eliminated';
      }
    }
    if (roster[run.active] === 'Available') roster[run.active] = 'Playing';
    const remaining = Object.values(roster).filter(state => state === 'Available' || state === 'Playing').length;
    return { roster, escapes, deaths, streak, remaining, latest: run.matches.at(-1) };
  }
  const model = { outcomes, summarize };
  if (typeof module === 'object') module.exports = model;
  else root.Hardcore = model;
})(globalThis);
