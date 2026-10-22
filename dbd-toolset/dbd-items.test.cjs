const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const c=vm.createContext({});
for(const file of ['dbd-stats.js','dbd-items-data.js','dbd-items.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),c);
const run=code=>vm.runInContext(code,c);
let checks=0;
const near=(a,b)=>{checks++;assert(Math.abs(a-b)<1e-8,`${a} != ${b}`)};
function result(item,addons=[],opts={}){c.item=item;c.addons=addons;c.options=opts;return run('calculateItem(item,addons,options)')}
near(run('DBD_ITEMS.items.length'),43);
near(run('itemCombinations("medkit").length'),848);
near(run('itemCombinations("toolbox").length'),670);
let r=result('engineers-toolbox');
near(r.capacity,16);near(r.rate,2);near(r.itemSeconds,8);near(r.time,82);near(r.saved,8);
r=result('commodious-toolbox');near(r.rate,1.5);near(r.time,32/1.5+58);
r=result('engineers-toolbox',['socket-swivels','clean-rag']);near(r.rate,2.5);near(r.time,16/2.5+74);
r=result('engineers-toolbox',['wire-spool','scraps']);near(r.capacity,36);near(r.time,72);
r=result('commodious-toolbox',['wire-spool','scraps']);near(r.capacity,52);
r=result('commodious-toolbox',['hacksaw','cutting-wire'],{planner:true,role:'S',build:['Resilience'],scenario:{health:'injured'}});near(r.sabotage,104.5);
r=result('engineers-toolbox',['brand-new-part'],{installed:true});near(r.charges,80);near(r.time,72);
r=result('engineers-toolbox',['brand-new-part'],{installed:false});near(r.time,82);
r=result('camping-aid-kit',[],{action:'others'});near(r.time,16/1.35);near(r.cost,16);near(r.fullHeals,1);
r=result('ranger-med-kit',[],{action:'self'});near(r.time,24);near(r.cost,24);near(r.fullHeals,1);
r=result('ranger-med-kit',['gel-dressings','gauze-roll'],{action:'self'});near(r.capacity,50);near(r.fullHeals,2);near(r.heals,50/24);
r=result('ranger-med-kit',['styptic-agent'],{action:'self'});near(r.cost,16/((2/3)*1.15));
r=result('ranger-med-kit',['abdominal-dressing'],{action:'others',planner:true,role:'S',build:['Botany Knowledge']});near(r.time,16/1.9);
r=result('ranger-med-kit',[],{action:'self',planner:true,role:'S',build:['Botany Knowledge']});near(r.time,16);
r=result('ranger-med-kit',[],{action:'self',planner:true,role:'S',build:["We'll Make It"],scenario:{active:{"We'll Make It":true}}});near(r.time,24);
r=result('ranger-med-kit',[],{action:'self',planner:true,role:'S',build:['No Mither']});assert(r.broken&&!r.canHeal);
r=result('ranger-med-kit',['anti-exhaustion-syringe'],{action:'self',consume:true});assert.equal(r.capacity,0);assert(!r.canHeal);
assert.throws(()=>result('engineers-toolbox',['clean-rag','clean-rag']),/different/);
assert.throws(()=>result('engineers-toolbox',['gel-dressings']),/does not fit/);
// Exercise every legal combination in both standalone and planner-modified scenarios.
for(const kind of ['toolbox','medkit']){
 c.kind=kind;const configs=JSON.parse(run('JSON.stringify(itemCombinations(kind))'));
 for(const config of configs){
  for(const options of [{action:'self'},{action:'others',planner:true,role:'S',build:['Botany Knowledge','Resilience'],scenario:{health:'injured'}}]){
   const value=result(config.item,config.addons,options);
   assert(Number.isFinite(value.time)&&value.time>0);assert(Number.isFinite(value.rate)&&value.rate>0);assert(value.capacity>=0);
   if(kind==='medkit')assert(value.fullHeals>=0);
  }
 }
}
console.log(`PASS: ${checks} item numeric checks; all 1,518 combinations across two scenarios; charge depletion; Diminishing Returns; self/altruistic healing; special-effect guards.`);
