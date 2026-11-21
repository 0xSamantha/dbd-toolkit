const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',disabled:false});return nodes.get(s)};
const c=vm.createContext({$:get});
vm.runInContext(fs.readFileSync(path.join(__dirname,'dbd-metrics.js'),'utf8'),c);
const run=s=>vm.runInContext(s,c);
c.records=[...['Escaped','Died','Draw','Surrendered'].map(result=>({role:'S',result})),...[0,1,2,3,4,'Draw','Surrendered'].map(result=>({role:'K',result}))];
const stats=run('summarizeMatches(records)');
assert.equal(stats.total,11);assert.equal(stats.wins,3);assert.equal(stats.losses,5);assert.equal(stats.draws,3);assert.equal(stats.surrenders,2);
assert.equal(stats.kills,10);assert.equal(stats.averageKills,2);assert.equal(stats.scoredKillerMatches,5);
assert.equal(stats.wins+stats.losses+stats.draws,stats.total);
assert.equal(stats.escapeRate,.25);assert.equal(stats.winRate,3/11);
assert.equal(run('summarizeMatches([]).averageKills'),null);
assert.equal(run('summarizeMatches([{role:"K",result:"Surrendered"}]).losses'),1);
assert.equal(run('summarizeMatches([{role:"K",result:"Surrendered"}]).averageKills'),null);
for(const role of ['S','K'])for(const result of ['Draw','Surrendered'])assert(run(`isValidMatchResult('${role}','${result}')`));
assert(!run('isValidMatchResult("K","4")'));assert(!run('isValidMatchResult("S",2)'));
c.streakRecords=[
 {id:1,date:'2026-11-20',role:'S',result:'Escaped',queue:'team'},
 {id:5,date:'2026-11-19',role:'K',result:2,queue:'solo'},
 {id:3,date:'2026-11-19',role:'S',result:'Escaped'},
 {id:4,date:'2026-11-19',role:'K',result:4,queue:'solo'},
 {id:2,date:'2026-11-18',role:'S',result:'Surrendered',queue:'team'}
];
assert.equal(run('JSON.stringify(summarizeWinStreaks(streakRecords))'),'{"current":1,"best":2}');
assert.equal(run('JSON.stringify(summarizeWinStreaks([]))'),'{"current":0,"best":0}');
assert.deepEqual(c.streakRecords.map(match=>match.id),[1,5,3,4,2],'Streak calculation preserves history order');
const queueHTML=run('streakAndQueueMetricsHTML(streakRecords,{solo:"Solo queue",team:"Team / duo"})');
assert.match(queueHTML,/Solo queue<\/th><td>2<\/td><td>1<\/td><td>0<\/td><td>1<\/td><td>50%/);
assert.match(queueHTML,/Team \/ duo<\/th><td>2<\/td><td>1<\/td><td>1<\/td><td>0<\/td><td>50%/);
assert.match(run('streakAndQueueMetricsHTML([],{solo:"Solo queue"})'),/<td>—<\/td>/);
let imported=null;
c.FogAccounts={validateMatch:m=>{if(!m?.id)throw Error('Invalid record');return {...m}},async importMatches(rows){imported=rows}};c.drawTrack=()=>{};
c.parsed={matches:[{id:1,role:'S',result:'Surrendered'},{id:2,role:'K',result:2}]};
run('previewMatchImport(parsed)');assert.equal(imported,null,'Preview must not save records');
assert(get('#match-import-preview').innerHTML.includes('1 losses (including 1 surrenders), 1 draws'));
get('#confirm-match-import').onclick().then(()=>{
 assert.equal(imported.length,2);
 run('previewMatchImport({id:3,role:"S",result:"Draw"})');assert.equal(run('pendingMatchImport.length'),1);
 assert.throws(()=>run('previewMatchImport([{oops:1}])'),/Invalid/);
 assert.equal(run('pendingMatchImport'),null);assert.equal(get('#match-import-preview').innerHTML,'');
 console.log('PASS: draw/surrender classification; loss totals; rates; unknown-kill exclusion; legacy results; JSON preview/confirmation and invalid import clearing.');
}).catch(error=>{console.error(error);process.exitCode=1});
