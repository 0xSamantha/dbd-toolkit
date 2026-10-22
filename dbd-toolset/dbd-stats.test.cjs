const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const context=vm.createContext({});
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
vm.runInContext(read('dbd-perks.js'),context);
vm.runInContext(read('dbd-stats.js'),context);
for(const name of ['dbd-items-data.js','dbd-items.js','dbd-observed.js','dbd-presets.js','dbd-metrics.js'])vm.runInContext(read(name),context);
let checks=0;
function near(actual,expected){checks++;assert(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`)}
function stats(names,role='S',scenario={}){
  context.names=names;context.role=role;context.scenario=scenario;
  return vm.runInContext('calculateBuildStats(names,role,{...buildScenario,...scenario,active:scenario.active||{}})',context);
}
const data=JSON.parse(read('perks.txt'));
assert.equal(data.version,'10.2.0');assert.equal(data.build,'10.2.0-3840818');
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(DBD_PERK_DATA)',context)),data);
assert.equal(data.perks.length,321);
assert.equal(data.killers.length,44);
assert.equal(data.perks.filter(p=>p.role==='survivor').length,176);
assert.equal(data.perks.filter(p=>p.role==='killer').length,145);
assert.equal(new Set(data.perks.map(p=>p.name)).size,321);
assert(data.perks.every(p=>p.desc&&p.icon.startsWith('https://cdn.source.gs/')&&p.meta.source&&Array.isArray(p.tiers)));
vm.runInContext('for(const name of Object.keys(BUILD_EFFECTS)) if(!DBD_PERK_DATA.perks.some(p=>p.name===name)) throw Error("Rule missing from dataset: "+name)',context);
// Every modeled tier array must be present in the imported patch description.
vm.runInContext(`for(const [name,rule] of Object.entries(BUILD_EFFECTS)){
  const perk=DBD_PERK_DATA.perks.find(p=>p.name===name);
  for(const values of Object.values(rule.effects)){
    if(Array.isArray(values)&&!perk.desc.includes(values.join('/')))throw Error('Tier mismatch: '+name+' '+values.join('/'));
  }
}`,context);
// Baselines and health conditions.
near(stats([]).genSeconds,90);
near(stats([],'S',{repairers:2}).genSeconds,90/1.7);
near(stats(['Resilience']).totals.repair,0);
for(let tier=0;tier<3;tier++)near(stats(['Resilience'],'S',{tier,health:'injured'}).totals.repair,[7,8,9][tier]);
near(stats(['No Mither','Resilience']).totals.vault,9);
near(stats(['Finesse'],'S',{health:'injured',active:{Finesse:true}}).totals.vault,0);
near(stats(['Finesse'],'S',{active:{Finesse:true}}).vaultFactor,1/1.2);
// Diminishing Returns sorts modifiers independently of build order.
const dr=values=>{context.values=values;return vm.runInContext('diminishSources(values.map((value,i)=>({name:String(i),value}))).reduce((s,v)=>s+v.effective,0)',context)};
near(dr([10,50,20,30,5,1]),50+15+5+1.25+.25+.05);
near(dr([9,50]),54.5);near(dr([50,9]),54.5);
near(stats(['Hope','Boon: Dark Theory'],'S',{active:{Hope:true,'Boon: Dark Theory':true}}).movement,4.26);
near(stats(['Sprint Burst','Lithe'],'S',{active:{'Sprint Burst':true,Lithe:true}}).movement,6);
near(stats(['Spine Chill'],'S',{active:{'Spine Chill':true}}).totals.repair,0);
near(stats(['Spine Chill'],'S',{active:{'Spine Chill':true}}).totals.heal,0);
near(stats(['Spine Chill'],'S',{active:{'Spine Chill':true}}).totals.vault,10);
near(stats(['Windows of Opportunity'],'S',{vaultType:'pallet',active:{'Windows of Opportunity':true}}).totals.vault,0);
near(stats(['Sole Survivor'],'S',{active:{'Sole Survivor':true}}).genSeconds,90);
// Healing: tier bonuses, tokens count as ONE source, stacking reduced.
for(let tier=0;tier<3;tier++)near(stats(['Botany Knowledge'],'S',{tier}).healSeconds,16/(1+[30,40,50][tier]/100));
near(stats(['Botany Knowledge','Resilience'],'S',{health:'injured'}).healSeconds,16/1.545);
near(stats(['Botany Knowledge','Empathic Connection']).healSeconds,16/1.7);
near(stats(['Flow State','Botany Knowledge'],'S',{tokens:5,active:{'Flow State':true}}).healSeconds,16/2);
near(stats(['Desperate Measures'],'S',{hurtSurvivors:4,active:{'Desperate Measures':true}}).healSeconds,16/1.8);
near(stats(['Do No Harm'],'S',{targetHooks:2,active:{'Do No Harm':true}}).healSeconds,16/1.8);
// Repair: regular/red, individual/team effects, negative speed, and progress charges.
for(let tier=0;tier<3;tier++){
  near(stats(['Déjà Vu'],'S',{tier,highlighted:0}).genSeconds,90);
  near(stats(['Déjà Vu'],'S',{tier,highlighted:1}).genSeconds,90/(1+[4,5,6][tier]/100));
}
near(stats(['Déjà Vu','Resilience'],'S',{health:'injured',highlighted:1}).genSeconds,90/1.12);
near(stats(['Prove Thyself'],'S',{active:{'Prove Thyself':true}}).totals.repair,0);
near(stats(['Prove Thyself','Resilience'],'S',{repairers:2,health:'injured',active:{'Prove Thyself':true}}).genSeconds,90/(.85*(1.145+1.1)));
near(stats(['Déjà Vu','Prove Thyself'],'S',{repairers:2,highlighted:1,active:{'Prove Thyself':true}}).genSeconds,90/(.85*(1.13+1.1)));
near(stats(['Overzealous'],'S',{hexTotem:true,active:{Overzealous:true}}).totals.repair,20);
near(stats(['Scavenger'],'S',{active:{Scavenger:true}}).genSeconds,180);
near(stats(['Scavenger','Déjà Vu'],'S',{highlighted:1,active:{Scavenger:true}}).genSeconds,90/(1.06*.5));
near(stats(['Invocation: Weaving Spiders'],'S',{active:{'Invocation: Weaving Spiders':true}}).genSeconds,80);
near(stats(['Invocation: Weaving Spiders','Resilience'],'S',{active:{'Invocation: Weaving Spiders':true}}).genSeconds,80/1.09);
near(stats(['Teamwork: Full Circuit']).totals.repair,0);
near(stats(['Teamwork: Full Circuit'],'S',{repairers:2}).totals.repair,5);
// Live killer values, not PTB, and successful basic-attack cooldown.
near(stats(['Machine Learning'],'K',{active:{'Machine Learning':true}}).totals.haste,8);
near(stats(['Bamboozle','Fire Up','Brutal Strength'],'K',{tokens:5,active:{'Fire Up':true}}).totals.vault,47.5);
near(stats(['Bamboozle','Fire Up','Brutal Strength'],'K',{tokens:5,active:{'Fire Up':true}}).totals.break,50);
near(stats(['Unrelenting'],'K').totals.miss,40);
near(stats(['Unrelenting'],'K').hitFactor,.9);
near(stats(['Unrelenting','Dark Arrogance'],'K').missFactor,.475);
near(stats(['Unrelenting','Help Wanted'],'K',{active:{'Help Wanted':true}}).hitFactor,.7);
assert.equal(stats(['Bond']).unsupported[0],'Bond');
// Render startup and exercise planner, search, warnings, calculator and conditional controls.
const nodes=new Map();
function get(selector){if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',value:'0',checked:false,setAttribute(){}});return nodes.get(selector)}
context.document={querySelector:get,addEventListener(){}};
context.window={addEventListener(){}};
context.location={hash:''};context.localStorage={getItem(){return null}};context.setInterval=()=>{};
const html=read('dbd-toolkit.html');
const inline=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
context.dataLayer=context.window.dataLayer=[];
vm.runInContext(inline,context);
const run=code=>vm.runInContext(code,context);
run('build=["Resilience","Finesse"];drawBuild()');
assert(get('#t-build').innerHTML.includes('aria-label="About Resilience"'));
assert(get('#build-stats').innerHTML.includes('Build speed estimates'));
run('activateBuildEffect("Sprint Burst",true);activateBuildEffect("Lithe",true)');
assert.equal(run('buildScenario.active["Sprint Burst"]'),false);
assert(run('buildNotes(["Sprint Burst","Lithe"],"S").some(n=>n.text.includes("shared Exhaustion"))'));
assert(!run('buildNotes(["Sprint Burst","Adrenaline"],"S").some(n=>n.kind==="warning")'));
assert(run('buildNotes(["Botany Knowledge","Empathic Connection"],"S").some(n=>n.text.includes("Diminishing Returns"))'));
run('setRole("K");build=["Unrelenting"];drawBuild()');
assert(get('#build-stats').innerHTML.includes('Successful basic attack cooldown'));
assert(get('#build-stats').innerHTML.includes('−40%'));
run('role="S";build=["Déjà Vu"];buildScenario.highlighted=1;usePlannerInCalc()');
assert.equal(run('calc.on["Déjà Vu"]'),true);
assert.equal(run('calc.highlighted'),1);
assert(get('#co').textContent.includes('84.9'));
run('calc.highlighted=0;calcOut()');assert(get('#co').textContent.includes('90.0'));
assert(get('#cd').innerHTML.includes('red revealed gen 84.9 s'));
run('build=["Déjà Vu","Resilience"];buildScenario.health="injured";buildScenario.highlighted=1;drawBuild();usePlannerInCalc()');
near(run('generatorEstimate().genSeconds'),run('calculateBuildStats(build,"S",buildScenario).genSeconds'));
run('build=["No Mither","Resilience"];buildScenario.health="healthy";usePlannerInCalc()');
near(run('generatorEstimate().genSeconds'),90/1.09);
// Calculator activation and settings update through their delegated events.
get('#t-calc').onchange({target:{dataset:{calc:'highlighted'},type:'select-one',value:'0'}});
near(run('generatorEstimate().genSeconds'),90/1.09);
run('role="S";build=["Botany Knowledge"];buildScenario.tier=2;drawBuild()');
assert(get('#build-stats').innerHTML.includes('10.67 s'));
assert(get('#build-stats').innerHTML.includes('50% healing speed'));
assert(!get('#build-stats').innerHTML.includes('reduces med-kit healing efficiency'));
run('build=[];drawBuild()');assert(get('#build-stats').innerHTML.includes('16.00 s'));
for(const query of ['deja vu','DEJA VU','Déjà Vu','De\u0301ja\u0300 Vu']){
 context.query=query;run('q=query;drawGrid()');assert(get('#grid').innerHTML.includes('data-n="Déjà Vu"'));
}
run('q="";drawGrid()');assert.equal((get('#grid').innerHTML.match(/data-n=/g)||[]).length,176);
// Refresh restores the URL tab, then a saved tab; shared-build links open the planner.
context.URL=URL;
const tabStorage=new Map();context.localStorage={getItem:k=>tabStorage.get(k)||null,setItem:(k,v)=>tabStorage.set(k,v)};
context.location.href='https://dbdtoolkit.xyz/dbd-toolset/dbd-toolkit.html#b=S:Bond';
context.window.history={replaceState(_state,_title,url){context.location.href=url}};
run('showTab("account")');
assert.equal(new URL(context.location.href).searchParams.get('tab'),'account');
assert.equal(new URL(context.location.href).hash,'#b=S:Bond');
assert.equal(run('initialTab()'),'account');
context.location.href='https://dbdtoolkit.xyz/dbd-toolset/dbd-toolkit.html';context.location.hash='';
assert.equal(run('initialTab()'),'account');
context.location.href+='?tab=invalid';run('store.set("fog.activeTab","invalid")');
assert.equal(run('initialTab()'),'build');
run('showTab("track")');
assert.equal(new URL(run('link()')).searchParams.get('tab'),'build');
// Game-style inventory equips one item and two distinct add-ons with live stats.
run('role="S";build=[];showTab("items");equipInventoryItem("commodious-toolbox")');
assert(get('#item-result').innerHTML.includes('32 base'));
run('itemCompare.activeSlot="addon0";equipInventoryItem("wire-spool");itemCompare.activeSlot="addon1";equipInventoryItem("scraps")');
assert.equal(run('calculateItem(itemCompare.item,itemCompare.addons).capacity'),52);
assert(get('#item-result').innerHTML.includes('32 base + 12 Wire Spool + 8 Scraps'));
run('equipInventoryItem("wire-spool")');
assert.equal(run('itemCompare.addons[0]'),'');
assert.equal(run('itemCompare.addons[1]'),'wire-spool');
run('itemCompare.kind="medkit";itemCompare.item="";itemCompare.addons=["",""];drawItems()');
assert(get('#item-result').innerHTML.includes('Heal another survivor'));
assert(get('#item-result').innerHTML.includes('Self-heal'));
assert(get('#t-items').innerHTML.includes('equipment-rack'));
// Every inventory tile and occupied equipment slot exposes an independent info button.
run('itemCompare.activeSlot="item";itemCompare.inventoryQuery="";drawItems()');
assert.equal((get('#item-inventory').innerHTML.match(/class="info item-info"/g)||[]).length,8);
assert(get('#t-items').innerHTML.includes('aria-label="About Ranger Med-kit"'));
run('itemCompare.activeSlot="addon0";drawItems()');
assert.equal((get('#item-inventory').innerHTML.match(/class="info item-info"/g)||[]).length,14);
const equippedBefore=run('JSON.stringify(itemCompare.addons)');
get('#t-items').onclick({target:{closest:()=>null}});
assert.equal(run('JSON.stringify(itemCompare.addons)'),equippedBefore);
// Presets and match loadouts: five slots, role filtering, optional recording and snapshots.
run('role="S";build=["Bond","Lithe"];saveBuildPreset(1,"Chase");');
assert.equal(run('readPresets()[0].perks.length'),2);
run('build.push("Hope")');assert.equal(run('readPresets()[0].perks.length'),2);
for(let slot=2;slot<=5;slot++)run(`saveBuildPreset(${slot},"Build ${slot}",["Bond"],"S")`);
assert.equal(run('readPresets().length'),5);
assert.throws(()=>run('saveBuildPreset(6,"Extra")'),/1–5/);
run('tr="S";matchPerkDraft={role:"S",enabled:false,perks:[],source:""};drawMatchPerks()');
assert.equal(get('#match-perk-fields').hidden,true);
get('#fp').checked=false;assert.equal(run('recordedMatchPerks().length'),0);
run('matchPerkDraft.enabled=true;drawMatchPerks()');
assert(get('#match-perk-fields').innerHTML.includes('Chase'));
get('#match-build-source').onchange({target:{value:'preset:1'}});
assert.equal(run('matchPerkDraft.perks.join("|")'),'Bond|Lithe');
run('saveBuildPreset(1,"Changed",["Hope"],"S")');
assert.equal(run('matchPerkDraft.perks.join("|")'),'Bond|Lithe','Selected loadouts are copies');
get('#fp').checked=true;get('#match-perk-0').value='Bond';get('#match-perk-1').value='Lithe';get('#match-perk-2').value='';get('#match-perk-3').value='';
assert.equal(run('recordedMatchPerks().join("|")'),'Bond|Lithe');
get('#match-perk-1').value='Bond';assert.throws(()=>run('recordedMatchPerks()'),/different/);
get('#fp').checked=false;assert.equal(run('recordedMatchPerks().length'),0);
run('setTR("K");matchPerkDraft.enabled=true;drawMatchPerks()');
assert(!get('#match-perk-fields').innerHTML.includes('preset:1'),'Only role-matching presets should be offered');
assert.equal(run('matchName("clown","K")'),"The Clown");
assert.equal(run('matchName("ONRYO","K")'),"The Onryō");
assert.equal(run('matchName("elodie","S")'),"Élodie Rakoto");
assert.equal(run('matchName("Meg","S")'),"Meg Thomas");
assert.equal(run('matchName("coal tower","map")'),"Coal Tower");
assert.equal(run('matchingNames("[.*","K").length'),44,'Search input is literal text, never executable regex');
assert.equal(run('matchName("unknown custom map","map")'),"unknown custom map");
assert.equal(run('matchChoices("S").length'),54);
run('tr="S";drawTrack()');
assert(get('#t-track').innerHTML.includes('Killer faced (optional)'));
assert(get('#t-track').innerHTML.includes('Map (optional)'));
run('tr="K";drawTrack()');
assert(!get('#t-track').innerHTML.includes('Killer faced (optional)'));
// October 22 UTC is still October 21 in California.
assert.equal(run('localMatchDate(new Date("2026-10-21T19:00:00-07:00"))'),
  new Date("2026-10-21T19:00:00-07:00").getFullYear()+"-"+
  String(new Date("2026-10-21T19:00:00-07:00").getMonth()+1).padStart(2,"0")+"-"+
  String(new Date("2026-10-21T19:00:00-07:00").getDate()).padStart(2,"0"));
assert.equal(run('localMatchDate({getFullYear:()=>2026,getMonth:()=>9,getDate:()=>21})'),"2026-10-21");
console.log(`PASS: ${checks} numeric checks; 321-perk dataset integrity; startup; search; warnings; planner/calculator parity; conditional controls and live 10.2.0 UI.`);
