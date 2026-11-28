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
function summarizeWinStreaks(records){
  const chronological=[...records].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  let current=0,best=0;
  for(const match of chronological){
    current=matchOutcome(match)==='win'?current+1:0;
    best=Math.max(best,current);
  }
  return {current,best};
}
function streakAndQueueMetricsHTML(records,queueLabels){
  const {current,best}=summarizeWinStreaks(records);
  const rows=Object.entries(queueLabels).map(([queue,label])=>{
    const {total,wins,losses,draws,winRate}=summarizeMatches(records.filter(match=>match.queue===queue));
    const rate=winRate===null?'—':Math.round(winRate*100)+'%';
    return `<tr><th scope="row">${label}</th><td>${total}</td><td>${wins}</td><td>${losses}</td><td>${draws}</td><td>${rate}</td></tr>`;
  });
  return `<section class="card" aria-labelledby="streak-queue-title">
    <h2 id="streak-queue-title">Win streaks and queue stats</h2>
    <div class="stats">
      <div class="stat"><span>Current win streak</span><b>${current}</b></div>
      <div class="stat"><span>Best win streak</span><b>${best}</b></div>
    </div>
    <p class="sub">Streaks follow match dates across both roles. A loss or draw ends a streak.</p>
    <h3 id="queue-stats-title">Solo vs team</h3>
    <div class="tablewrap"><table aria-labelledby="queue-stats-title">
      <thead><tr><th scope="col">Queue</th><th scope="col">Matches</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Draws</th><th scope="col">Win rate</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>
    <p class="sub">Queue stats use the tag saved with each match. Edit a match in History to add or change its tag.</p>
  </section>`;
}
/* ===== Statistics page =====
 * Optional per-match statistics travel inside the match record. Blank values
 * are omitted, so totals and averages below use recorded values only.
 */
const MATCH_STAT_EMBLEMS={
  S:[['benevolent','Benevolent'],['evader','Evader'],['lightbringer','Lightbringer'],['unbroken','Unbroken']],
  K:[['gatekeeper','Gatekeeper'],['devout','Devout'],['malicious','Malicious'],['ruthless','Ruthless']]
};
const MATCH_STAT_FIELDS={bloodpoints:1000000,healed:99,timesHooked:99,chasesWon:999,longestChaseMs:3600000};
function normalizeMatchStats(stats,role){
  if(stats===undefined)return undefined;
  if(!stats||typeof stats!=='object'||Array.isArray(stats))throw Error('Match statistics must be an object.');
  if(!MATCH_STAT_EMBLEMS[role])throw Error('Match statistics need a survivor or killer role.');
  const clean={};
  for(const [key,value] of Object.entries(stats)){
    if(key==='emblems')continue;
    if(!Object.hasOwn(MATCH_STAT_FIELDS,key))throw Error('Unknown match statistic: '+key);
    if(!Number.isSafeInteger(value)||value<0||value>MATCH_STAT_FIELDS[key])throw Error('Invalid '+key+' value.');
    clean[key]=value;
  }
  if(role==='K'&&clean.healed!==undefined)throw Error('Healing is only recorded for survivor matches.');
  if(stats.emblems!==undefined){
    if(!stats.emblems||typeof stats.emblems!=='object'||Array.isArray(stats.emblems))throw Error('Emblems must be an object.');
    const allowed=new Set(MATCH_STAT_EMBLEMS[role].map(([key])=>key)),emblems={};
    for(const [key,value] of Object.entries(stats.emblems)){
      if(!allowed.has(key))throw Error('Unknown emblem for this role: '+key);
      if(!Number.isInteger(value)||value<0||value>4)throw Error('Emblem grades must be 0–4.');
      emblems[key]=value;
    }
    if(Object.keys(emblems).length)clean.emblems=emblems;
  }
  return Object.keys(clean).length?clean:undefined;
}
function filterMatchesByPeriod(records,period,now=new Date()){
  if(period!=='30')return records;
  const key=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  const cutoff=new Date(now.getFullYear(),now.getMonth(),now.getDate()-29),today=key(now),first=key(cutoff);
  return records.filter(match=>typeof match.date==='string'&&match.date>=first&&match.date<=today);
}
function formatStatNumber(value){
  const [whole,fraction]=String(value).split('.');
  const grouped=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return fraction===undefined?grouped:grouped+'.'+fraction;
}
function formatStatAverage(value){return value===null||value===undefined?'–':formatStatNumber(Number(value.toFixed(2)))}
function formatStatPercent(value){return value===null||value===undefined?'–':(value*100).toFixed(2)+'%'}
function formatChaseDuration(ms){
  const seconds=Math.round(ms/1000);
  return seconds<60?seconds+' s':Math.floor(seconds/60)+' m '+(seconds%60)+' s';
}
function statTotal(values){return values.reduce((sum,value)=>sum+value,0)}
function statAverage(values){return values.length?statTotal(values)/values.length:null}
function matchStatisticsSummary(records,role){
  const scoped=records.filter(match=>match.role===role),summary=summarizeMatches(scoped);
  const values=key=>scoped.map(match=>match.stats?.[key]).filter(value=>value!==undefined);
  const bloodpoints=values('bloodpoints'),healed=values('healed'),hooks=values('timesHooked'),chases=values('chasesWon'),chaseTimes=values('longestChaseMs');
  const emblems={};
  for(const [key,label] of MATCH_STAT_EMBLEMS[role]){
    const grades=scoped.map(match=>match.stats?.emblems?.[key]).filter(value=>value!==undefined);
    emblems[key]={label,recorded:grades.length,earned:grades.filter(value=>value>0).length,total:statTotal(grades),average:statAverage(grades)};
  }
  return {...summary,matches:scoped.length,withStats:scoped.filter(match=>match.stats).length,
    bloodpoints:{total:statTotal(bloodpoints),recorded:bloodpoints.length,average:statAverage(bloodpoints)},
    healed:{total:statTotal(healed),recorded:healed.length,average:statAverage(healed)},
    timesHooked:{total:statTotal(hooks),recorded:hooks.length,average:statAverage(hooks)},
    chasesWon:{total:statTotal(chases),recorded:chases.length,average:statAverage(chases)},
    longestChaseMs:chaseTimes.length?Math.max(...chaseTimes):null,emblems};
}
function optionalMatchStatisticsHTML(records){
  const blocks=['S','K'].map(role=>({role,summary:matchStatisticsSummary(records,role)})).filter(({summary})=>summary.withStats);
  if(!blocks.length)return '<p class="sub">No optional match statistics recorded yet. Add them when logging or editing a match.</p>';
  return blocks.map(({role,summary})=>{
    const card=(name,value,note='')=>`<div class="stat"><span>${name}</span><b>${value}</b>${note?`<small>${note}</small>`:''}</div>`;
    const count=(value,singular,plural)=>value+' '+(value===1?singular:plural);
    const recorded=entry=>count(entry.recorded,'match','matches')+' recorded';
    const bucket=entry=>entry.recorded?formatStatNumber(entry.total):'–';
    const average=value=>formatStatAverage(value);
    const cards=role==='S'?[
      card('Total Bloodpoints earned',bucket(summary.bloodpoints),recorded(summary.bloodpoints)),
      card('Average Bloodpoints earned',average(summary.bloodpoints.average),'Recorded values only'),
      card('Total survivors healed',bucket(summary.healed),recorded(summary.healed)),
      card('Average survivors healed',average(summary.healed.average),'Recorded values only'),
      card('Total times hooked',bucket(summary.timesHooked),recorded(summary.timesHooked)),
      card('Average times hooked',average(summary.timesHooked.average),'Recorded values only'),
      card('Total chases won',bucket(summary.chasesWon),recorded(summary.chasesWon)),
      card('Longest chase time',summary.longestChaseMs===null?'–':formatChaseDuration(summary.longestChaseMs),'Longest recorded chase')
    ]:[
      card('Total Bloodpoints earned',bucket(summary.bloodpoints),recorded(summary.bloodpoints)),
      card('Average Bloodpoints earned',average(summary.bloodpoints.average),'Recorded values only'),
      card('Total survivors hooked',bucket(summary.timesHooked),recorded(summary.timesHooked)),
      card('Average hooks',average(summary.timesHooked.average),'Recorded values only'),
      card('Total chases won',bucket(summary.chasesWon),recorded(summary.chasesWon)),
      card('Longest chase time',summary.longestChaseMs===null?'–':formatChaseDuration(summary.longestChaseMs),'Longest recorded chase')
    ];
    const emblemCards=Object.values(summary.emblems).map(emblem=>card(emblem.label,emblem.recorded?formatStatNumber(emblem.earned):'–',emblem.recorded?emblem.recorded+' recorded · avg '+average(emblem.average):'No emblem grades recorded'));
    return `<h4>${RN[role]} statistics</h4><div class="stats">${cards.join('')}${emblemCards.join('')}</div><p class="sub">Optional statistics recorded in ${summary.withStats} of ${count(summary.matches,RN[role].toLowerCase()+' match',RN[role].toLowerCase()+' matches')}. Totals and averages use recorded values only.</p>`;
  }).join('');
}
function matchPerformanceGroups(records,role,group='perk'){
  const scoped=records.filter(match=>match.role===role);
  const base=group==='perk'?scoped.filter(match=>Array.isArray(match.perks)&&match.perks.length):scoped;
  const entries=new Map();
  for(const match of base){
    const names=group==='perk'?[...new Set(match.perks)]:[match.character];
    for(const name of names){
      if(!name)continue;
      if(!entries.has(name))entries.set(name,[]);
      entries.get(name).push(match);
    }
  }
  return {base:base.length,entries:[...entries].map(([name,matches])=>{
    const stats=summarizeMatches(matches);
    return {name,matches:matches.length,wins:stats.wins,losses:stats.losses,draws:stats.draws,
      pickRate:base.length?matches.length/base.length:null,rate:role==='S'?stats.escapeRate:stats.winRate};
  })};
}
function sortPerformanceGroups(entries,sort){
  const rank=value=>value===null||value===undefined?-1:value;
  return [...entries].sort((a,b)=>
    sort==='name'?a.name.localeCompare(b.name):
    sort==='matches'?b.matches-a.matches||rank(b.rate)-rank(a.rate)||a.name.localeCompare(b.name):
    sort==='rate'?rank(b.rate)-rank(a.rate)||b.matches-a.matches||a.name.localeCompare(b.name):
    rank(b.pickRate)-rank(a.pickRate)||b.matches-a.matches||a.name.localeCompare(b.name));
}
function matchStatisticsHTML(records,role,period='all',sort='pick',now=new Date()){
  const scoped=filterMatchesByPeriod(records,period,now),summary=matchStatisticsSummary(scoped,role);
  const roleLabel=typeof RN!=='undefined'?RN[role]:(role==='S'?'Survivor':'Killer');
  const rateLabel=role==='S'?'Escape rate':'Win rate';
  const optionalLabel=role==='S'?'Bloodpoints, healing, hook, chase and emblem':'Bloodpoints, hook, chase and emblem';
  const escStat=value=>typeof esc==='function'?esc(value):String(value);
  const icon=name=>typeof perkIcon==='function'?perkIcon(name):'';
  const card=(name,value,note='')=>`<div class="stat"><span>${name}</span><b>${value}</b>${note?`<small>${note}</small>`:''}</div>`;
  const count=(value,singular,plural)=>value+' '+(value===1?singular:plural);
  const cards=role==='S'?[
    card('Total matches played',summary.matches),
    card('Total escapes',summary.escapes,count(summary.deaths,'death','deaths')+' recorded'),
    card('Escape rate',formatStatPercent(summary.escapeRate),'Escapes ÷ survivor matches')
  ]:[
    card('Total matches played',summary.matches),
    card('Total kills',formatStatNumber(summary.kills),count(summary.scoredKillerMatches,'scored match','scored matches')),
    card('Average killer kills',summary.averageKills===null?'–':summary.averageKills.toFixed(2),'Known kill counts only'),
    card('Win rate',formatStatPercent(summary.winRate),'3–4 kills = win; 2 = draw')
  ];
  const performance=matchPerformanceGroups(scoped,role,'perk'),characters=matchPerformanceGroups(scoped,role,'character');
  const perkCards=sortPerformanceGroups(performance.entries,sort).map(entry=>`<div class="performance-card">${icon(entry.name)}<h3>${escStat(entry.name)}</h3><div class="performance-metrics"><span>Pick rate<b>${formatStatPercent(entry.pickRate)}</b></span><span>${rateLabel}<b>${formatStatPercent(entry.rate)}</b></span></div><small>${entry.matches} ${entry.matches===1?'match':'matches'}</small></div>`).join('');
  const characterRows=sortPerformanceGroups(characters.entries,sort).map(entry=>`<tr><th scope="row">${escStat(entry.name)}</th><td>${entry.matches}</td><td>${entry.wins}</td><td>${entry.losses}</td><td>${entry.draws}</td><td>${formatStatPercent(entry.pickRate)}</td><td>${formatStatPercent(entry.rate)}</td></tr>`).join('');
  return `<section class="card" aria-labelledby="stats-totals-title"><h2 id="stats-totals-title">Total ${roleLabel.toLowerCase()} stats</h2><div class="stats">${cards.join('')}</div><p class="sub">${rateLabel} includes every match in the period. Optional ${optionalLabel} statistics are summarized in Advanced match analysis on the Match tracker.</p></section>
  <section class="card" aria-labelledby="stats-perks-title"><h2 id="stats-perks-title">${roleLabel} perks</h2>${perkCards?`<div class="performance-grid">${perkCards}</div>`:'<p class="sub">No perks recorded in this period. Add perks when logging a match to build pick-rate and rate cards.</p>'}<p class="sub">Pick rate uses ${performance.base} ${performance.base===1?'match':'matches'} with a recorded loadout. ${rateLabel} uses only matches where the perk was recorded. Small samples are not proof that a perk changes outcomes.</p></section>
  <section class="card" aria-labelledby="stats-characters-title"><h2 id="stats-characters-title">Characters</h2>${characterRows?`<div class="tablewrap"><table aria-labelledby="stats-characters-title"><thead><tr><th scope="col">Character</th><th scope="col">Played</th><th scope="col">Wins</th><th scope="col">Losses</th><th scope="col">Draws</th><th scope="col">Play rate</th><th scope="col">${rateLabel}</th></tr></thead><tbody>${characterRows}</tbody></table></div>`:'<p class="sub">No character history in this period.</p>'}<p class="sub">Play rate uses all ${roleLabel.toLowerCase()} matches in the period. Win, loss and draw totals follow the match tracker conventions.</p></section>`;
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
  const optionalStats=optionalMatchStatisticsHTML(records);
  return `<details class="card"><summary>Advanced match analysis</summary><h3>Results by role</h3>${table(['Role','Played','Won','Lost','Draw','Surrender'],roleRows)}<h3>Killer kill distribution</h3><div class="stats">${distribution.map((n,k)=>`<div class="stat"><span>${k} kills</span><b>${n}</b></div>`).join('')}</div><p class="sub">Explicit draws and surrenders have no kill count and are excluded from kill averages and this distribution.</p><h3>Optional match statistics</h3>${optionalStats}<h3>Characters</h3>${charRows.length?table(['Character','Role','Played','Won','Lost','Draw'],charRows):'<p>No character history yet.</p>'}<h3>Perk usage</h3>${perkRows.length?table(['Perk','Matches recorded','Win rate'],perkRows):'<p>Select perks when logging a match to build this analysis.</p>'}<p class="sub">Perk results include only matches where those perks were recorded. Sample sizes matter; this is your history, not evidence that a perk causes wins. Observed builds are excluded from all metrics.</p></details>`;
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
