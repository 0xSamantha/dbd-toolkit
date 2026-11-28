const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const esc=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const c=vm.createContext({esc,RN:{S:'Survivor',K:'Killer'},perkIcon:name=>`<img class="perk-icon" data-perk="${esc(name)}">`});
vm.runInContext(fs.readFileSync(path.join(__dirname,'dbd-metrics.js'),'utf8'),c);
const run=source=>vm.runInContext(source,c);

assert.equal(run('normalizeMatchStats({bloodpoints:12000,healed:2,timesHooked:1,chasesWon:3,longestChaseMs:64000,emblems:{benevolent:4,evader:0}},"S")&&JSON.stringify(normalizeMatchStats({bloodpoints:12000,healed:2,timesHooked:1,chasesWon:3,longestChaseMs:64000,emblems:{benevolent:4,evader:0}},"S"))'),
  '{"bloodpoints":12000,"healed":2,"timesHooked":1,"chasesWon":3,"longestChaseMs":64000,"emblems":{"benevolent":4,"evader":0}}');
assert.equal(run('normalizeMatchStats(undefined,"S")'),undefined);
assert.equal(run('normalizeMatchStats({},"K")'),undefined);
assert.throws(()=>run('normalizeMatchStats({bloodpoints:-1},"S")'),/Invalid bloodpoints/);
assert.throws(()=>run('normalizeMatchStats({unknown:1},"S")'),/Unknown match statistic/);
assert.throws(()=>run('normalizeMatchStats({healed:1},"K")'),/Healing is only recorded/);
assert.throws(()=>run('normalizeMatchStats({emblems:{benevolent:5}},"S")'),/0–4/);
assert.throws(()=>run('normalizeMatchStats({emblems:{gatekeeper:4}},"S")'),/Unknown emblem/);
assert.throws(()=>run('normalizeMatchStats({emblems:[]},"S")'),/Emblems must be an object/);

assert.equal(run('formatStatNumber(0)'),'0');
assert.equal(run('formatStatNumber(1234567)'),'1,234,567');
assert.equal(run('formatStatNumber(40693.73)'),'40,693.73');
assert.equal(run('formatStatAverage(1.5)'),'1.5');
assert.equal(run('formatStatAverage(40693.726)'),'40,693.73');
assert.equal(run('formatStatAverage(null)'),'–');
assert.equal(run('formatStatPercent(.6532)'),'65.32%');
assert.equal(run('formatStatPercent(null)'),'–');
assert.equal(run('formatChaseDuration(54000)'),'54 s');
assert.equal(run('formatChaseDuration(64000)'),'1 m 4 s');
assert.equal(run('formatChaseDuration(60000)'),'1 m 0 s');

c.statRecords=[
  {id:1,date:'2026-11-26',role:'S',character:'Meg',result:'Escaped',perks:['Deja Vu','Resilience'],stats:{bloodpoints:30000,healed:2,timesHooked:1,chasesWon:3,longestChaseMs:64000,emblems:{benevolent:4,evader:3,lightbringer:4,unbroken:2}}},
  {id:2,date:'2026-10-01',role:'S',character:'Meg',result:'Died',perks:['Deja Vu'],stats:{bloodpoints:10000,healed:1,timesHooked:2,chasesWon:1,longestChaseMs:30000,emblems:{benevolent:0,evader:1,lightbringer:2,unbroken:0}}},
  {id:3,date:'2026-11-20',role:'S',character:'Claudette',result:'Escaped',perks:[]},
  {id:4,date:'2026-11-20',role:'K',character:'The Clown',result:3,perks:['Pop Goes the Weasel'],stats:{bloodpoints:25000,timesHooked:3,chasesWon:2,longestChaseMs:45000,emblems:{gatekeeper:3,devout:4,malicious:2,ruthless:4}}}
];
assert.equal(run('filterMatchesByPeriod(statRecords,"30",new Date("2026-11-27T12:00:00")).map(match=>match.id).join(",")'),'1,3,4');
assert.equal(run('filterMatchesByPeriod(statRecords,"all",new Date("2026-11-27T12:00:00")).length'),4);
assert.equal(run('filterMatchesByPeriod(statRecords,"30",new Date("2027-01-15T12:00:00")).length'),0);
c.futureStat=[{id:6,date:'2026-11-28',role:'S',character:'Meg',result:'Escaped',perks:[]}];
assert.equal(run('filterMatchesByPeriod(futureStat,\"30\",new Date(\"2026-11-27T12:00:00\")).length'),0);

const survivor=run('matchStatisticsSummary(statRecords,"S")');
assert.equal(survivor.matches,3);assert.equal(survivor.escapes,2);assert.equal(survivor.deaths,1);
assert.equal(survivor.withStats,2);assert.equal(survivor.escapeRate,2/3);
assert.equal(survivor.bloodpoints.total,40000);assert.equal(survivor.bloodpoints.recorded,2);assert.equal(survivor.bloodpoints.average,20000);
assert.equal(survivor.healed.total,3);assert.equal(survivor.healed.average,1.5);
assert.equal(survivor.timesHooked.total,3);assert.equal(survivor.timesHooked.average,1.5);
assert.equal(survivor.chasesWon.total,4);assert.equal(survivor.chasesWon.average,2);
assert.equal(survivor.longestChaseMs,64000);
assert.equal(survivor.emblems.benevolent.recorded,2);assert.equal(survivor.emblems.benevolent.earned,1);
assert.equal(survivor.emblems.benevolent.average,2);
assert.equal(survivor.emblems.evader.earned,2);assert.equal(survivor.emblems.lightbringer.average,3);
assert.equal(survivor.emblems.unbroken.earned,1);assert.equal(survivor.emblems.unbroken.average,1);

const killer=run('matchStatisticsSummary(statRecords,"K")');
assert.equal(killer.matches,1);assert.equal(killer.kills,3);assert.equal(killer.averageKills,3);
assert.equal(killer.winRate,1);assert.equal(killer.bloodpoints.total,25000);
assert.equal(killer.timesHooked.total,3);assert.equal(killer.chasesWon.total,2);assert.equal(killer.longestChaseMs,45000);
assert.equal(killer.emblems.devout.earned,1);assert.equal(killer.emblems.devout.average,4);
assert.equal(run('matchStatisticsSummary([],"S").bloodpoints.average'),null);

assert.equal(run('matchPerformanceGroups(statRecords,"S","perk").base'),2);
assert.equal(run('matchPerformanceGroups(statRecords,"S","perk").entries.map(entry=>entry.name+":"+entry.matches+":"+entry.pickRate+":"+entry.rate).join("|")'),'Deja Vu:2:1:0.5|Resilience:1:0.5:1');
assert.equal(run('matchPerformanceGroups(statRecords,"S","character").entries.map(entry=>entry.name+":"+entry.matches+":"+entry.pickRate+":"+entry.rate).join("|")'),'Meg:2:0.6666666666666666:0.5|Claudette:1:0.3333333333333333:1');
assert.equal(run('matchPerformanceGroups(statRecords,"K","perk").entries[0].rate'),1);
assert.equal(run('matchPerformanceGroups(statRecords,"K","character").base'),1);
c.blankCharacter=[{id:5,date:'2026-11-20',role:'S',character:'',result:'Escaped',perks:[],notes:''}];
assert.equal(run('matchPerformanceGroups(blankCharacter,"S","character").base'),1);
assert.equal(run('matchPerformanceGroups(blankCharacter,"S","character").entries.length'),0);

assert.equal(run('sortPerformanceGroups([{name:"B",matches:1,pickRate:.2,rate:.1},{name:"A",matches:2,pickRate:.1,rate:.9}],"pick").map(e=>e.name).join("")'),'BA');
assert.equal(run('sortPerformanceGroups([{name:"B",matches:1,pickRate:.2,rate:.1},{name:"A",matches:2,pickRate:.1,rate:.9}],"rate").map(e=>e.name).join("")'),'AB');
assert.equal(run('sortPerformanceGroups([{name:"B",matches:1,pickRate:.2,rate:.1},{name:"A",matches:2,pickRate:.1,rate:.9}],"matches").map(e=>e.name).join("")'),'AB');
assert.equal(run('sortPerformanceGroups([{name:"B",matches:1,pickRate:.2,rate:.1},{name:"A",matches:2,pickRate:.1,rate:.9}],"name").map(e=>e.name).join("")'),'AB');
const survivorHTML=run('matchStatisticsHTML(statRecords,"S","30","pick",new Date("2026-11-27T12:00:00"))');
assert.match(survivorHTML,/Total survivor stats/);
assert.match(survivorHTML,/Total escapes<\/span><b>2<\/b><small>0 deaths recorded/);
assert.match(survivorHTML,/Escape rate<\/span><b>100\.00%<\/b>/);
assert.match(survivorHTML,/Total Bloodpoints earned<\/span><b>30,000<\/b>/);
assert.match(survivorHTML,/Average survivors healed<\/span><b>2<\/b>/);
assert.match(survivorHTML,/Longest chase time<\/span><b>1 m 4 s<\/b>/);
assert.match(survivorHTML,/Benevolent<\/span><b>1<\/b>/);
assert.match(survivorHTML,/Deja Vu/);
assert.match(survivorHTML,/data-perk="Deja Vu"/);
assert.match(survivorHTML,/Pick rate<b>100\.00%<\/b>/);
assert.match(survivorHTML,/Meg/);
assert.match(survivorHTML,/50\.00%/);
assert.match(survivorHTML,/1 of 2 survivor matches include performance statistics/);

const killerHTML=run('matchStatisticsHTML(statRecords,"K","all","rate",new Date("2026-11-27T12:00:00"))');
assert.match(killerHTML,/Total killer stats/);
assert.match(killerHTML,/Total kills<\/span><b>3<\/b>/);
assert.match(killerHTML,/1 scored match<\/small>/);
assert.match(killerHTML,/Win rate<\/span><b>100\.00%<\/b>/);
assert.match(killerHTML,/1 of 1 killer match includes performance statistics/);
assert.match(killerHTML,/The Clown/);
assert.match(killerHTML,/Devout/);

const emptyHTML=run('matchStatisticsHTML([],"S","all","pick",new Date())');
assert.match(emptyHTML,/Total survivor stats/);
assert.match(emptyHTML,/<b>–<\/b>/);
assert.match(emptyHTML,/0 matches recorded/);
assert.match(emptyHTML,/No perks recorded in this period/);
assert.match(emptyHTML,/No character history in this period/);

console.log('PASS: match statistic validation; period filtering; total/average/emblem aggregation; perk and character rates; sorting; statistics HTML and empty states.');
