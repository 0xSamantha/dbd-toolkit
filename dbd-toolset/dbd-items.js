/* 10.2.0 item estimates. Add-on speed modifiers are exempt from Diminishing Returns.
 * Toolbox charges measure progress, not seconds. After depletion, repairs continue bare-handed.
 * Skill checks and triggered effects are displayed separately from steady action speed.
 */
let itemCompare={kind:'toolbox',item:'',addons:['',''],action:'others',planner:false,installed:false,consume:false,query:'',page:0,sort:'time',pinned:null};
function itemChoices(kind,addon){return DBD_ITEMS.items.filter(i=>i.kind===kind&&i.addon===addon)}
function itemFactor(sources,baseBonus,addonBonus){
  const positive=sources.filter(s=>s.value>0),negative=sources.filter(s=>s.value<0);
  if(baseBonus)positive.push({name:'Item base bonus',value:baseBonus});
  return (actionFactor(positive)+addonBonus/100)*actionFactor(negative);
}
function calculateItem(itemId,addonIds,options={}){
  const item=DBD_ITEMS.items.find(i=>i.id===itemId&&!i.addon);if(!item)throw Error('Select an item.');
  const ids=addonIds.filter(Boolean);if(ids.length>2||new Set(ids).size!==ids.length)throw Error('Choose up to two different add-ons.');
  const addons=ids.map(id=>{const a=DBD_ITEMS.items.find(i=>i.id===id&&i.addon&&i.kind===item.kind);if(!a)throw Error('That add-on does not fit this item.');return a});
  const state={...buildScenario,...options.scenario,active:{...(options.scenario?.active||buildScenario.active)},repairers:1};
  const names=options.planner&&options.role==='S'?(options.build||[]):[];
  if(options.action==='self'&&state.health==='healthy')state.health='injured';
  const perks=calculateBuildStats(names,'S',state);
  const sum=key=>addons.reduce((n,a)=>n+(Number(a.effects[key])||0),0);
  let capacity=item.effects.charges+sum('charges');
  const consumed=!!options.consume&&addons.some(a=>a.effects.consumes);
  if(consumed)capacity=0;
  const notes=[];
  for(const a of addons){if(a.effects.skillChecks)notes.push(a.name+': skill-check effects are not included in the steady-speed estimate.');if(a.effects.consumes)notes.push(a.name+': activation consumes the med-kit; its status effect does not increase the healing estimate.');}
  if(item.kind==='toolbox'){
    const charges=Math.max(0,perks.charges-(options.installed?sum('genReduction'):0));
    const rate=itemFactor(perks.raw.repair,item.effects.repair,sum('repair'));
    const bare=perks.personalRate;
    const itemProgress=Math.min(capacity,charges);
    const time=itemProgress/rate+Math.max(0,charges-itemProgress)/bare;
    if(sum('genReduction'))notes.push('Brand New Part: select successful installation to apply its charge reduction. Installation time is excluded.');
    if(addons.some(a=>a.name==='Instructions'))notes.push('Instructions prevents skill checks while using the toolbox.');
    return {item,addons,capacity,rate,time,bare,charges,itemSeconds:capacity/rate,progress:itemProgress,
      saved:perks.genSeconds-time,sabotage:item.effects.sabotage+sum('sabotage'),sabotages:Math.floor(capacity/6),hookRespawn:sum('hookRespawn'),notes,unsupported:perks.unsupported};
  }
  const self=options.action==='self';
  const altruisticOnly=new Set(["We'll Make It",'Empathic Connection','No One Left Behind','Do No Harm','Boon: Circle of Healing']);
  const sources=perks.raw.heal.filter(s=>!self||!altruisticOnly.has(s.name));
  // Circle of Healing's speed applies only without a med-kit.
  const usable=sources.filter(s=>s.name!=='Boon: Circle of Healing');
  const speed=itemFactor(usable,self?0:item.effects.healOthers,sum('heal'))*(self?2/3:1);
  const efficiency=(self?2/3:1)*(1+sum('selfEfficiency')*(self?1:0)/100);
  const cost=16/efficiency,heals=capacity/cost;
  const broken=self&&(names.includes('No Mither')||(names.includes('Invocation: Weaving Spiders')&&state.active['Invocation: Weaving Spiders']));
  if(self)notes.push('Self-heal assumes you are injured. The med-kit’s rounded 33% speed/efficiency penalties are modeled as two-thirds; mending is excluded.');
  if(broken)notes.push('Broken prevents healing yourself to Healthy.');
  if(names.includes('Boon: Circle of Healing'))notes.push('Circle of Healing speed requires healing without a med-kit and is excluded here.');
  return {item,addons,capacity,rate:speed,time:16/speed,cost,heals,fullHeals:Math.floor(heals+1e-9),canHeal:!broken&&capacity+1e-9>=cost,broken,consumed,notes,unsupported:perks.unsupported};
}
function itemCombinations(kind){
  const addons=itemChoices(kind,true),pairs=[[]];
  addons.forEach((a,i)=>{pairs.push([a.id]);addons.slice(i+1).forEach(b=>pairs.push([a.id,b.id]))});
  return itemChoices(kind,false).flatMap(item=>pairs.map(ids=>({item:item.id,addons:ids})));
}
function comparisonOptions(){return {action:itemCompare.action,planner:itemCompare.planner,role,build,scenario:buildScenario,installed:itemCompare.installed,consume:itemCompare.consume}}
function drawItems(){
  const node=$('#t-items');if(!node)return;
  const state=itemCompare,items=itemChoices(state.kind,false),addons=itemChoices(state.kind,true);
  if(!items.some(i=>i.id===state.item))state.item=items[0].id;
  state.addons=state.addons.map(id=>addons.some(a=>a.id===id)?id:'');
  const select=(key,value,choices)=>`<select data-item-setting="${key}">${choices.map(([v,n])=>`<option value="${v}" ${v===value?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
  node.innerHTML=`<div class="card"><h2>Toolboxes & med-kits</h2><p class="sub">Compare every item with zero, one or two different compatible add-ons from the 10.2.0 snapshot. Steady-speed estimates assume uninterrupted solo use.</p><div class="row">
  <label>Item kind${select('kind',state.kind,[['toolbox','Toolboxes'],['medkit','Med-kits']])}</label><label>Item${select('item',state.item,items.map(i=>[i.id,i.name+' · '+i.rarity]))}</label>
  ${state.kind==='medkit'?`<label>Healing target${select('action',state.action,[['others','Heal another survivor'],['self','Heal yourself']])}</label>`:''}</div>
  <div class="row">${[0,1].map(i=>`<label>Add-on ${i+1}${select('addon'+i,state.addons[i],[['','None'],...addons.map(a=>[a.id,a.name])])}</label>`).join('')}</div>
  <label class="effect-toggle"><input type="checkbox" data-item-setting="planner" ${state.planner&&role==='S'?'checked':''} ${role!=='S'?'disabled':''}>Use my survivor planner perks, tier and activation conditions (solo repair)</label>
  <label class="effect-toggle"><input type="checkbox" data-item-setting="${state.kind==='toolbox'?'installed':'consume'}" ${state.kind==='toolbox'?state.installed?'checked':'':state.consume?'checked':''}>${state.kind==='toolbox'?'Brand New Part successfully installed (excludes installation time)':'Activate any consuming add-on before healing (uses up the med-kit)'}</label>
  <p class="sub">${state.planner&&role==='S'?`Using: ${esc(build.join(', ')||'no selected perks')}. Change conditional effects in the planner, then return here.`:'Comparing base items without planner perks.'}</p>
  <button class="btn ghost" data-item-action="pin">Pin this setup for comparison</button><div class="item-comparisons"><div id="item-result"></div><div id="item-pinned"></div></div></div>
  <div class="card"><h2>All combinations</h2><div class="row"><label>Search items and add-ons<input id="item-search" type="search" value="${esc(state.query)}" placeholder="e.g. Wire Spool"></label><label>Sort${select('sort',state.sort,[['time','Fastest completion'],['capacity','Most charges'],['rate','Fastest active speed']])}</label></div><div id="item-rankings"></div></div>`;
  node.onchange=e=>{
    const key=e.target.dataset.itemSetting;if(!key)return;
    const value=e.target.type==='checkbox'?e.target.checked:e.target.value;
    if(key.startsWith('addon')){
      const index=Number(key.slice(-1));state.addons[index]=value;
      if(value&&state.addons[1-index]===value)state.addons[1-index]='';
    }else state[key]=value;
    if(key==='kind'){state.item='';state.addons=['',''];state.pinned=null;state.query='';state.consume=false;state.installed=false;}
    state.page=0;drawItems();
  };
  node.onclick=e=>{
    const b=e.target.closest('[data-item-action]');if(!b)return;
    if(b.dataset.itemAction==='pin'){state.pinned={item:state.item,addons:[...state.addons]};drawItemResults()}
    if(b.dataset.itemAction==='unpin'){state.pinned=null;drawItemResults()}
    if(b.dataset.itemAction==='page'){state.page+=Number(b.dataset.step);drawItemRankings()}
    if(b.dataset.itemAction==='inspect'){state.item=b.dataset.id;state.addons=JSON.parse(b.dataset.addons);drawItems();$('#item-result').scrollIntoView({block:'start',behavior:'smooth'})}
  };
  $('#item-search').oninput=e=>{state.query=e.target.value;state.page=0;drawItemRankings()};
  drawItemResults();drawItemRankings();
}
function itemResultHTML(result,title){
  const stat=(label,value)=>`<div class="stat"><span>${label}</span><b>${value}</b></div>`;
  return `<article class="card"><h3>${esc(title)}</h3><p><img class="perk-icon" src="${esc(result.item.icon)}" alt="" width="48" height="48" loading="lazy">${esc(result.item.name)} · ${esc(result.addons.map(a=>a.name).join(' + ')||'No add-ons')}</p><div class="stats">${stat('Total charges',result.capacity)}${stat('Active speed',result.rate.toFixed(3)+' ch/s')}
  ${result.item.kind==='toolbox'?stat('Full generator',result.time.toFixed(2)+' s')+stat('Time saved vs bare hands',result.saved.toFixed(2)+' s')+stat('Toolbox use until empty',result.itemSeconds.toFixed(2)+' s')+stat('Item/add-on sabotage bonus','+'+result.sabotage+'%')+stat('Full hook sabotages',result.sabotages):stat('One full heal',result.broken?'Blocked':result.time.toFixed(2)+' s')+stat('Charges per heal',result.cost.toFixed(2))+stat('Available healing',result.heals.toFixed(2)+' health states')+stat('Complete heals',result.fullHeals)}</div>
  ${result.item.kind==='medkit'&&!result.canHeal?'<p class="warning">This setup cannot complete a full heal in this situation. The time above assumes enough charges and no Broken status.</p>':''}
  <details><summary>Item and add-on effects</summary>${[result.item,...result.addons].map(i=>`<p><b>${esc(i.name)}</b>: ${esc(i.description)}</p>`).join('')}</details>
  ${result.notes.map(n=>`<p class="sub">${esc(n)}</p>`).join('')}${result.unsupported.length?`<p class="sub">Planner perks not modeled: ${esc(result.unsupported.join(', '))}.</p>`:''}
  <small>Add-on speed bonuses are not reduced by Diminishing Returns. Perk and item base bonuses use the shared stacking rules. No skill-check progression, recharging, interruptions, killer debuffs or automatic consumable timing is simulated.</small></article>`;
}
function drawItemResults(){
  try{
    $('#item-result').innerHTML=itemResultHTML(calculateItem(itemCompare.item,itemCompare.addons,comparisonOptions()),'Selected setup');
    $('#item-pinned').innerHTML=itemCompare.pinned?itemResultHTML(calculateItem(itemCompare.pinned.item,itemCompare.pinned.addons,comparisonOptions()),'Pinned setup — same current conditions')+'<button class="btn ghost" data-item-action="unpin">Remove pinned comparison</button>':'';
  }catch(error){$('#item-result').textContent=error.message;}
}
function drawItemRankings(){
  const state=itemCompare,query=searchText(state.query),options=comparisonOptions();
  const list=itemCombinations(state.kind).map(c=>calculateItem(c.item,c.addons,options)).filter(r=>searchText([r.item.name,...r.addons.map(a=>a.name)].join(' ')).includes(query));
  list.sort((a,b)=>state.sort==='capacity'?b.capacity-a.capacity:state.sort==='rate'?b.rate-a.rate:a.time-b.time);
  const pages=Math.max(1,Math.ceil(list.length/25));state.page=Math.max(0,Math.min(state.page,pages-1));
  $('#item-rankings').innerHTML=`<p class="sub">${list.length} valid combinations · page ${state.page+1} of ${pages}. ${state.kind==='medkit'?'Fastest completion assumes sufficient charges; capacity is listed separately.':''}</p><div class="tablewrap"><table><thead><tr><th>Item / add-ons</th><th>Charges</th><th>${state.kind==='toolbox'?'Full gen (s)':'Full heal (s)'}</th><th>Inspect</th></tr></thead><tbody>${list.slice(state.page*25,state.page*25+25).map(r=>`<tr><td>${esc(r.item.name)}<br><small>${esc(r.addons.map(a=>a.name).join(' + ')||'None')}</small></td><td>${r.capacity}</td><td>${r.broken?'Blocked':r.time.toFixed(2)}${state.kind==='medkit'&&!r.canHeal?'*':''}</td><td><button class="btn ghost" data-item-action="inspect" data-id="${r.item.id}" data-addons="${esc(JSON.stringify(r.addons.map(a=>a.id)))}">View</button></td></tr>`).join('')}</tbody></table></div><div class="row"><button class="btn ghost" data-item-action="page" data-step="-1" ${state.page===0?'disabled':''}>Previous</button><button class="btn ghost" data-item-action="page" data-step="1" ${state.page>=pages-1?'disabled':''}>Next</button></div>${state.kind==='medkit'?'<p class="sub">* Not enough usable charges for a complete heal, or healing is blocked.</p>':''}`;
}
