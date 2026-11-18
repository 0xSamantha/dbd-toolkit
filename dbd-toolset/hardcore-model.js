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
  const transferKey = 'fog.hardcore.match-transfer';
  function toGeneralMatch(run, index) {
    const match = run.matches[index];
    const at = new Date(match.at);
    const date = [at.getFullYear(), String(at.getMonth() + 1).padStart(2, '0'), String(at.getDate()).padStart(2, '0')].join('-');
    const killer = run.role === 'killer';
    const disconnected = match.outcome === 'Disconnected';
    const result = disconnected ? null : killer ? killerOutcomes.indexOf(match.outcome) :
      match.outcome === 'Escaped' ? 'Escaped' : 'Died';
    const notes = [
      'Hardcore: ' + run.title,
      match.outcome !== 'Escaped' && !killer && 'Outcome: ' + match.outcome,
      disconnected && killer && 'Outcome: Disconnected',
      match.cause && 'Cause: ' + match.cause,
      match.vod && 'VOD: ' + match.vod
    ].filter(Boolean).join(' · ').slice(0, 300);
    return {
      id: at.getTime(), date, role: killer ? 'K' : 'S', character: match.character,
      result, perks: match.perks ?? [], notes,
      map: match.map?.slice(0, 80), opposingKiller: match.killer?.slice(0, 80),
      durationMs: match.durationMs, observed: match.observed, queue: match.queue,
      hardcoreSource: run.id + ':' + index
    };
  }
  const model = { outcomes, killerOutcomes, summarize, transferKey, toGeneralMatch };
  if (typeof module === 'object') module.exports = model;
  else root.Hardcore = model;
})(globalThis);
