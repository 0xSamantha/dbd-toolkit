/* Patch 10.2.0-3840818. Perk text/icons: https://dbd.source.gs/perks/
 * Live values: https://bugreport.deadbydaylight.com/projects/pr-5642738318/releases/6012
 * Diminishing Returns: https://forums.bhvr.com/dead-by-daylight/kb/articles/544-9-6-0-patch-notes
 * Model only explicit effects; never derive numeric rules from flavor text.
 */
const BUILD_EFFECTS={
  'Botany Knowledge':{effects:{heal:[30,40,50]}},
  'Déjà Vu':{when:'highlighted',effects:{repair:[4,5,6]}},
  'Resilience':{when:'injured',effects:{repair:[7,8,9],heal:[7,8,9],vault:[7,8,9]}},
  'Prove Thyself':{when:'Other repairers are within 4 m',team:true,effects:{repair:[6,8,10]}},
  'Spine Chill':{when:'12-second effect after Killer looks at you within 40 m',effects:{vault:10}},
  'Windows of Opportunity':{when:'Window vault bonus off cooldown',window:true,effects:{vault:10}},
  'Finesse':{when:'healthy',effects:{vault:20}},
  'Overzealous':{when:'Totem blessed or cleansed; bonus not lost to damage',effects:{repair:[8,9,10]}},
  'Friendly Competition':{when:'Shared-gen bonus active for you and all current repairers (80/85/90 s)',team:true,effects:{repair:10}},
  'Boon: Steadfast':{when:'Repairing a generator inside your active boon range',team:true,effects:{repair:[8,9,10]}},
  'Object of Obsession':{when:'Killer can see your Aura',effects:{repair:[8,9,10],heal:[8,9,10]}},
  'Teamwork: Full Circuit':{when:'coop',effects:{repair:5}},
  'Teamwork: Soft-Spoken':{when:'coop',effects:{repair:5}},
  'Scavenger':{when:'Repair penalty active after toolbox recharge (40/35/30 s)',effects:{repair:-50}},
  "We'll Make It":{when:'Healing bonus active after unhook (70/80/90 s)',effects:{heal:100}},
  'Empathic Connection':{effects:{heal:[30,35,40]}},
  'Boon: Circle of Healing':{when:'Inside your active boon range, healing another survivor without a med-kit',effects:{heal:[50,75,100]}},
  'No One Left Behind':{when:'All generators completed',effects:{heal:[80,90,100]}},
  'Desperate Measures':{when:'Injured, downed or hooked survivor count selected below',count:'hurtSurvivors',effects:{heal:[16,18,20]}},
  'Do No Harm':{when:'Healing target hook states selected below',count:'targetHooks',effects:{heal:[30,35,40]}},
  'Flow State':{when:'Completed-generator tokens selected below',count:'tokens',effects:{heal:[13,14,15]}},
  'Hope':{when:'All generators completed',effects:{haste:[3,4,5]}},
  'Boon: Dark Theory':{when:'Inside your active boon range or lingering effect',effects:{haste:3}},
  'Made for This':{when:'deep',effects:{haste:3}},
  'Sprint Burst':{when:'2-second sprint active',exhaustion:true,effects:{haste:50}},
  'Lithe':{when:'3-second sprint active after medium or fast vault',exhaustion:true,effects:{haste:50}},
  'Balanced Landing':{when:'3-second sprint active after fall',exhaustion:true,effects:{haste:50}},
  'Smash Hit':{when:'4-second sprint active after pallet stun',exhaustion:true,effects:{haste:50}},
  'Background Player':{when:'5-second sprint active after Killer picks up a survivor',exhaustion:true,effects:{haste:50}},
  'Dramaturgy':{when:'2-second Haste active while healthy and running',healthy:true,exhaustion:true,effects:{haste:25}},
  'Adrenaline':{when:'4-second sprint active after all generators completed',effects:{haste:50}},
  'Breakout':{when:'Within 5 m of a carried survivor',effects:{haste:[6,8,10]}},
  'Blood Pact':{when:'After healing with Obsession, within 16 m and not the Obsession',effects:{haste:[5,6,7]}},
  'Teamwork: Power of Two':{when:'After healing another survivor, both remain within 8/12/16 m or 4-second linger',effects:{haste:5}},
  'Wide Open Throttle':{when:'3-second Haste active after fast-vaulting a pallet',effects:{haste:[10,12.5,15]}},
  'Bamboozle':{window:true,effects:{vault:[5,10,15]}},
  'Dark Arrogance':{window:true,effects:{vault:[15,20,25],miss:[15,20,25]}},
  'Superior Anatomy':{when:'10-second basic-vault bonus active after nearby medium/fast vault within 12 m',window:true,effects:{vault:[30,35,40]}},
  'Brutal Strength':{effects:{break:[10,15,20]}},
  'Fire Up':{when:'Completed-generator tokens selected below',count:'tokens',window:true,effects:{vault:[6,7,8],break:[6,7,8],pickup:[6,7,8]}},
  'Unrelenting':{effects:{miss:[30,35,40],hit:10}},
  'Help Wanted':{when:'Compromised generator completed; effect active (70/80/90 s)',effects:{hit:25}},
  'Rapid Brutality':{when:'Haste active after basic-attack damage (8/9/10 s); Bloodlust disabled',effects:{haste:5}},
  'Batteries Included':{when:'Within 16 m of a completed generator or 1/3/5-second linger',effects:{haste:5}},
  'Machine Learning':{when:'Compromised generator completed; effect active (40/50/60 s)',effects:{haste:8}},
  'Hex: No One Escapes Death':{when:'All generators completed and Hex active',effects:{haste:[2,3,4]}},
  'Whispers':{when:'More than 28/26/24 m from every survivor',effects:{haste:5}},
  'Furtive Chase':{when:'Haste active after hooking Obsession (14/16/18 s)',effects:{haste:10}},
  'Unbound':{when:'25-second Haste active after qualifying basic-window vault',effects:{haste:5}},
  'Play With Your Food':{when:'Chase tokens selected below',count:'chaseTokens',effects:{haste:[3,4,5]}},
  'Hex: Devour Hope':{when:'Hex active with 2+ tokens; 10-second Haste after hook active',effects:{haste:[3,4,5]}},
  'Invocation: Weaving Spiders':{when:'Invocation completed (permanent charges and Broken)',effects:{genCharges:[8,9,10]}}
};
let buildScenario={tier:2,health:'healthy',repairers:1,killerBase:4.6,tokens:0,hurtSurvivors:0,targetHooks:0,chaseTokens:0,vaultType:'window',active:{},hexTotem:false,highlighted:0};
const DR_WEIGHTS=[1,.5,.25,.125];
function diminishSources(sources){
  // Bonuses and penalties are different modifiers. Do not let one cancel the other's rank.
  return [1,-1].flatMap(sign=>sources.filter(s=>Math.sign(s.value)===sign)
    .sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)||a.name.localeCompare(b.name))
    .map((s,i)=>({...s,weight:DR_WEIGHTS[i]??.05,effective:s.value*(DR_WEIGHTS[i]??.05)})));
}
function actionFactor(sources){
  const values=diminishSources(sources);
  const positive=values.filter(s=>s.effective>0).reduce((sum,s)=>sum+s.effective,0);
  const penalties=values.filter(s=>s.effective<0).reduce((factor,s)=>factor*(1+s.effective/100),1);
  return (1+positive/100)*penalties;
}
function calculateBuildStats(names,r,state){
  const raw=Object.fromEntries(['haste','repair','teamRepair','heal','vault','break','pickup','miss','hit','genCharges'].map(k=>[k,[]]));
  const applied=[],unsupported=names.filter(n=>!BUILD_EFFECTS[n]);
  const invocation=names.includes('Invocation: Weaving Spiders')&&!!state.active['Invocation: Weaving Spiders'];
  const injury=names.includes('No Mither')||invocation||state.health!=='healthy';
  let exhaustionUsed=false;
  for(const name of names){
    const rule=BUILD_EFFECTS[name];if(!rule)continue;
    let enabled=!rule.when||!!state.active[name];
    if(rule.when==='injured')enabled=injury;
    if(rule.when==='healthy')enabled=!injury&&!!state.active[name];
    if(rule.when==='highlighted')enabled=!!state.highlighted;
    if(rule.when==='deep')enabled=state.health==='deep';
    if(rule.when==='coop')enabled=state.repairers>1;
    if(rule.healthy&&injury)enabled=false;
    if(rule.exhaustion&&enabled){if(exhaustionUsed)enabled=false;else exhaustionUsed=true;}
    if(!enabled)continue;
    applied.push(name);
    for(const [key,values] of Object.entries(rule.effects)){
      if(key==='vault'&&rule.window&&r==='S'&&state.vaultType==='pallet')continue;
      let value=Array.isArray(values)?values[state.tier]:values;
      if(rule.count)value*=state[rule.count]||0;
      if(name==='Overzealous'&&state.hexTotem)value*=2;
      if(name==='Prove Thyself')value*=state.repairers-1;
      if(value)raw[key].push({name,value});
      if(value&&rule.team&&key==='repair')raw.teamRepair.push({name,value});
    }
  }
  if(state.extraRepair)raw.repair.push({name:'Extra repair source',value:state.extraRepair});
  const breakdown=Object.fromEntries(Object.entries(raw).map(([key,values])=>[key,diminishSources(values)]));
  const totals=Object.fromEntries(Object.entries(breakdown).map(([key,values])=>[key,values.reduce((sum,s)=>sum+s.effective,0)]));
  for(const key of ['repair','teamRepair','heal','vault','break','pickup'])totals[key]=(actionFactor(raw[key])-1)*100;
  const efficiency=[1,.85,.7,.55][state.repairers-1];
  const personalRate=efficiency*actionFactor(raw.repair);
  const teamRate=personalRate+(state.repairers-1)*efficiency*actionFactor(raw.teamRepair);
  const charges=90-totals.genCharges;
  return {totals,breakdown,applied,unsupported,personalRate,charges,genSeconds:charges/teamRate,
    movement:(r==='S'?4:state.killerBase)+4*totals.haste/100,
    vaultFactor:1/actionFactor(raw.vault),healSeconds:16/actionFactor(raw.heal),
    breakFactor:1/actionFactor(raw.break),pickupFactor:1/actionFactor(raw.pickup),
    missFactor:1-totals.miss/100,hitFactor:1-totals.hit/100};
}
function updateBuildScenario(key,value){
  buildScenario[key]=value;drawBuildStats();
}
function activateBuildEffect(name,checked){
  if(checked&&BUILD_EFFECTS[name].exhaustion){
    for(const n of Object.keys(buildScenario.active))if(BUILD_EFFECTS[n]?.exhaustion)buildScenario.active[n]=false;
  }
  buildScenario.active[name]=checked;drawBuildStats();
}
function drawBuildStats(){
  const state=buildScenario,result=calculateBuildStats(build,role,state),t=result.totals;
  const regular=calculateBuildStats(build,role,{...state,highlighted:0});
  const highlighted=calculateBuildStats(build,role,{...state,highlighted:1});
  const select=(key,options)=>`<select data-stat="${key}">${options.map(([v,label])=>`<option value="${v}" ${String(state[key])===String(v)?'selected':''}>${label}</option>`).join('')}</select>`;
  const conditions=build.filter(n=>BUILD_EFFECTS[n]?.when&&!['injured','deep','highlighted','coop'].includes(BUILD_EFFECTS[n].when));
  const fmt=value=>Number(value.toFixed(3));
  const labels={haste:'Movement Haste',repair:'Repair speed',heal:'Healing speed',vault:'Vault speed',break:'Break / damage speed',pickup:'Pickup / drop speed',miss:'Missed basic-attack cooldown reduction',hit:'Successful basic-attack cooldown reduction',genCharges:'Permanent generator charges'};
  const stat=(label,value,note)=>`<div class="stat"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
  $('#build-stats').innerHTML=`<details class="card" open><summary>Build speed estimates</summary>
    <p class="sub">Choose your situation. Conditional effects start off; check them only while their trigger is active. Values and stacking use patch ${esc(DBD_PERK_DATA.version)}.</p>
    <div class="row"><label>Perk tier${select('tier',[[0,'I'],[1,'II'],[2,'III']])}</label>
    ${role==='S'?`<label>Health${select('health',[['healthy','Healthy'],['injured','Injured'],['deep','Injured + Deep Wound']])}</label><label>Survivors repairing${select('repairers',[[1,'1'],[2,'2'],[3,'3'],[4,'4']])}</label>`:`<label>Base killer speed${select('killerBase',[[4.6,'4.6 m/s'],[4.4,'4.4 m/s'],[3.85,'3.85 m/s'],[4,'4.0 m/s']])}</label>`}</div>
    ${role==='S'&&build.includes('Déjà Vu')?`<label>Generator being repaired${select('highlighted',[[0,'Regular generator'],[1,'Red generator revealed by Déjà Vu']])}</label>`:''}
    <div class="row">${build.some(n=>BUILD_EFFECTS[n]?.count==='tokens')?`<label>Completed generators / tokens${select('tokens',[[0,'0'],[1,'1'],[2,'2'],[3,'3'],[4,'4'],[5,'5']])}</label>`:''}
    ${build.includes('Desperate Measures')?`<label>Injured / downed / hooked survivors${select('hurtSurvivors',[[0,'0'],[1,'1'],[2,'2'],[3,'3'],[4,'4']])}</label>`:''}
    ${build.includes('Do No Harm')?`<label>Healing target hook states${select('targetHooks',[[0,'0'],[1,'1'],[2,'2']])}</label>`:''}
    ${build.includes('Play With Your Food')?`<label>Chase tokens${select('chaseTokens',[[0,'0'],[1,'1'],[2,'2'],[3,'3']])}</label>`:''}
    ${role==='S'?`<label>Vault type${select('vaultType',[['window','Fast window vault'],['pallet','Fast pallet vault']])}</label>`:''}</div>
    ${conditions.map(n=>`<label class="effect-toggle"><input type="checkbox" data-effect="${esc(n)}" ${state.active[n]?'checked':''}><span>${esc(n)}: ${esc(BUILD_EFFECTS[n].when==='healthy'?'Healthy fast vault, off cooldown':BUILD_EFFECTS[n].when)}</span></label>`).join('')}
    ${build.includes('Overzealous')?`<label class="effect-toggle"><input type="checkbox" data-stat="hexTotem" ${state.hexTotem?'checked':''}>Overzealous used a Hex totem (double bonus)</label>`:''}
    <div class="stats">${stat('Running speed',result.movement.toFixed(2)+' m/s','+'+fmt(t.haste)+'% Haste; no powers, items or Bloodlust')}
    ${role==='S'?stat('Your repair speed',result.personalRate.toFixed(3)+' ch/s',(t.repair>=0?'+':'')+fmt(t.repair)+'% effective modifier; co-op penalty included')+stat('Generator time',result.genSeconds.toFixed(1)+' s',result.charges+' charges remaining; all repairers working continuously')+stat('Heal another survivor',result.healSeconds.toFixed(2)+' s','+'+fmt(t.heal)+'% healing speed; normal 16-second heal; no med-kit or self-healing') :stat('Break / damage speed','+'+fmt(t.break)+'%','Duration × '+result.breakFactor.toFixed(3))+stat('Missed basic attack cooldown','−'+fmt(t.miss)+'%','Duration × '+result.missFactor.toFixed(3)+'; basic attacks only')+stat('Successful basic attack cooldown','−'+fmt(t.hit)+'%','Duration × '+result.hitFactor.toFixed(3))+stat('Pickup / drop speed','+'+fmt(t.pickup)+'%','Duration × '+result.pickupFactor.toFixed(3))}
    ${stat(role==='S'?'Vault speed':'Window vault speed','+'+fmt(t.vault)+'%','Duration × '+result.vaultFactor.toFixed(3)+(role==='S'?'; fast vault when Finesse is active':''))}</div>
    ${role==='S'&&build.includes('Déjà Vu')?`<p class="sub"><b>Déjà Vu comparison:</b> regular generator: ${regular.personalRate.toFixed(3)} ch/s, ${regular.genSeconds.toFixed(1)} s; red highlighted generator: ${highlighted.personalRate.toFixed(3)} ch/s, ${highlighted.genSeconds.toFixed(1)} s. Tier ${['I','II','III'][state.tier]} bonus: +${[4,5,6][state.tier]}% to your repair speed on revealed generators only. Other selected conditions stay the same.</p>`:''}
    <p class="sub">${build.includes('No Mither')?'No Mither forces the injured state for these calculations. ':''}Applied: ${esc(result.applied.join(', ')||'no modeled bonuses active')}. ${result.unsupported.length?`Not modeled: ${esc(result.unsupported.join(', '))}. Their effects are excluded.`:''}</p>
    
    <details><summary>Applied modifiers and Diminishing Returns</summary>${Object.entries(result.breakdown).filter(([key,values])=>values.length&&key!=='teamRepair').map(([key,values])=>`<p><b>${esc(labels[key]||key)}:</b> ${values.map(v=>`${esc(v.name)} ${fmt(v.value)}${key==='genCharges'?' charges':'%'} × ${v.weight*100}% = ${fmt(v.effective)}${key==='genCharges'?' charges':'%'}`).join('; ')}</p>`).join('')||'<p>No active numeric modifiers.</p>'}</details>
    <small>Diminishing Returns ranks each repeated modifier: 100%, 50%, 25%, 12.5%, then 5%. Perk tokens form one source. Action bonuses are reduced before converting to time; penalties are multiplicative. Teammates receive only modeled team buffs; their other perks are excluded. No skill checks, toolboxes, regression, injury hit-burst, attack animations or killer powers. Temporary sprint is a momentary speed, not a permanent bonus.</small></details>`;
  $('#build-stats').onchange=e=>{
    const el=e.target;
    if(el.dataset.effect)activateBuildEffect(el.dataset.effect,el.checked);
    else if(el.dataset.stat)updateBuildScenario(el.dataset.stat,el.type==='checkbox'?el.checked:['health','vaultType'].includes(el.dataset.stat)?el.value:Number(el.value));
  };
}
