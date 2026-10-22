/* App reporting conventions, not an official universal DBD win condition:
 * survivor escape = win; death/surrender = loss; killer 0–1 kills = loss,
 * 2 kills = draw, 3–4 kills = win. Explicit draws/surrenders have unknown kills.
 */
function isValidMatchResult(role,result){
  return role==='S'?['Escaped','Died','Draw','Surrendered'].includes(result):role==='K'&&
    ((Number.isInteger(result)&&result>=0&&result<=4)||['Draw','Surrendered'].includes(result));
}
function matchOutcome(match){
  if(match.result==='Surrendered')return 'loss';
  if(match.result==='Draw')return 'draw';
  if(match.role==='S')return match.result==='Escaped'?'win':'loss';
  return match.result>=3?'win':match.result===2?'draw':'loss';
}
function matchResultLabel(match){return match.role==='K'&&typeof match.result==='number'?match.result+' kills':String(match.result)}
function summarizeMatches(records){
  const stats={total:records.length,wins:0,losses:0,draws:0,surrenders:0,survivors:0,killers:0,escapes:0,deaths:0,kills:0,scoredKillerMatches:0,perksTracked:0};
  for(const match of records){
    const outcome=matchOutcome(match);stats[outcome==='win'?'wins':outcome==='draw'?'draws':'losses']++;
    if(match.result==='Surrendered')stats.surrenders++;
    if(match.perks?.length)stats.perksTracked++;
    if(match.role==='S'){stats.survivors++;if(match.result==='Escaped')stats.escapes++;if(match.result==='Died')stats.deaths++;}
    else{stats.killers++;if(typeof match.result==='number'){stats.kills+=match.result;stats.scoredKillerMatches++;}}
  }
  stats.winRate=stats.total?stats.wins/stats.total:null;
  stats.escapeRate=stats.survivors?stats.escapes/stats.survivors:null;
  stats.averageKills=stats.scoredKillerMatches?stats.kills/stats.scoredKillerMatches:null;
  return stats;
}
function matchMetricsHTML(records){
  const m=summarizeMatches(records),percent=n=>n===null?'–':Math.round(n*100)+'%';
  const card=(name,value,note='')=>`<div class="stat"><span>${name}</span><b>${value}</b><small>${note}</small></div>`;
  return `<div class="card"><h2>Total match metrics</h2><div class="stats">${card('Matches',m.total,m.survivors+' survivor · '+m.killers+' killer')}${card('Wins',m.wins)}${card('Losses',m.losses,'Includes surrenders')}${card('Draws',m.draws)}${card('Surrenders',m.surrenders,'Already included in losses')}${card('Win rate',percent(m.winRate),'Wins ÷ all matches, including draws')}${card('Survivor escape rate',percent(m.escapeRate))}${card('Average killer kills',m.averageKills===null?'–':m.averageKills.toFixed(2),'Known kill counts only')}</div><p class="sub">Killer convention: 0–1 kills = loss, 2 = draw, 3–4 = win. Survivor draws can be recorded explicitly. Surrender always counts as a loss.</p></div>`;
}
function advancedMatchMetricsHTML(records){
  const grouped=new Map(),perkUse=new Map(),distribution=[0,0,0,0,0];
  for(const m of records){
    const key=m.role+':'+m.character;if(!grouped.has(key))grouped.set(key,{role:m.role,character:m.character,records:[]});grouped.get(key).records.push(m);
    for(const perk of new Set(m.perks||[])){if(!perkUse.has(perk))perkUse.set(perk,[]);perkUse.get(perk).push(m);}
    if(m.role==='K'&&typeof m.result==='number')distribution[m.result]++;
  }
  const table=(headers,rows)=>`<div class="tablewrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const roleRows=['S','K'].map(role=>{const s=summarizeMatches(records.filter(m=>m.role===role));return `<tr><td>${RN[role]}</td><td>${s.total}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td><td>${s.surrenders}</td></tr>`});
  const charRows=[...grouped.values()].sort((a,b)=>b.records.length-a.records.length).map(g=>{const s=summarizeMatches(g.records);return `<tr><td>${esc(g.character)}</td><td>${RN[g.role]}</td><td>${s.total}</td><td>${s.wins}</td><td>${s.losses}</td><td>${s.draws}</td></tr>`});
  const perkRows=[...perkUse].sort((a,b)=>b[1].length-a[1].length).map(([name,list])=>{const s=summarizeMatches(list);return `<tr><td>${esc(name)}</td><td>${list.length}</td><td>${Math.round(s.winRate*100)}%</td></tr>`});
  return `<details class="card"><summary>Advanced match analysis</summary><h3>Results by role</h3>${table(['Role','Played','Won','Lost','Draw','Surrender'],roleRows)}<h3>Killer kill distribution</h3><div class="stats">${distribution.map((n,k)=>`<div class="stat"><span>${k} kills</span><b>${n}</b></div>`).join('')}</div><p class="sub">Explicit draws and surrenders have no kill count and are excluded from kill averages and this distribution.</p><h3>Characters</h3>${charRows.length?table(['Character','Role','Played','Won','Lost','Draw'],charRows):'<p>No character history yet.</p>'}<h3>Perk usage</h3>${perkRows.length?table(['Perk','Matches recorded','Win rate'],perkRows):'<p>Enable Record perks on a match to build this analysis.</p>'}<p class="sub">Perk results include only matches where those perks were recorded. Sample sizes matter; this is your history, not evidence that a perk causes wins. Observed builds are excluded from all metrics.</p></details>`;
}
let pendingMatchImport=null;
function previewMatchImport(parsed){
  pendingMatchImport=null;$('#match-import-preview').innerHTML='';
  const rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.matches)?parsed.matches:[parsed];
  if(rows.length>5000)throw Error('Import up to 5,000 match records at a time.');
  pendingMatchImport=null;
  const validated=rows.map(m=>FogAccounts.validateMatch(m));
  pendingMatchImport=[...new Map(validated.map(m=>[m.id,m])).values()];
  const s=summarizeMatches(pendingMatchImport);
  $('#match-import-preview').innerHTML=`<p>${s.total} valid matches: ${s.wins} wins, ${s.losses} losses (including ${s.surrenders} surrenders), ${s.draws} draws. Existing IDs will be updated; other history is kept.</p><button class="btn" type="button" id="confirm-match-import">Confirm import</button> <button class="btn ghost" type="button" id="cancel-match-import">Cancel</button>`;
  $('#confirm-match-import').onclick=async()=>{
    const button=$('#confirm-match-import');button.disabled=true;
    try{await FogAccounts.importMatches(pendingMatchImport);pendingMatchImport=null;drawTrack()}catch(error){$('#match-import-status').textContent='Import failed: '+error.message;button.disabled=false}
  };
  $('#cancel-match-import').onclick=()=>{pendingMatchImport=null;$('#match-import-preview').innerHTML=''};
}
async function previewMatchFile(file){
  try{
    if(!file)return;if(file.size>5*1024*1024)throw Error('Choose a JSON file under 5 MB.');
    previewMatchImport(JSON.parse(await file.text()));$('#match-import-status').textContent='Review the records before importing.';
  }catch(error){pendingMatchImport=null;$('#match-import-preview').innerHTML='';$('#match-import-status').textContent='Could not read match data: '+error.message}
}
