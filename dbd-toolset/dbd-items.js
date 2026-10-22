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
      saved:perks.genSeconds-time,sabotage:(itemFactor(perks.raw.sabotage||[],item.effects.sabotage,sum('sabotage'))-1)*100,sabotages:Math.floor(capacity/6),hookRespawn:sum('hookRespawn'),notes,unsupported:perks.unsupported};
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
function itemRarityClass(item){
  const rarity=(item?.rarity||'').toLowerCase();
  return rarity.includes('visceral')?'visceral':rarity.includes('very rare')?'very-rare':rarity.includes('uncommon')?'uncommon':rarity.includes('rare')?'rare':'common';
}
function itemInfo(item){
  return item?`<button type="button" class="info item-info" aria-describedby="tip" aria-label="About ${esc(item.name)}" data-d="${esc(item.name+' — '+item.description)}">i</button>`:'';
}
function itemTile(item){return item?`<img src="${esc(item.icon)}" alt="" width="64" height="64" loading="lazy"><span class="loadout-tile-name">${esc(item.name)}</span>`:'<span class="empty-item-slot" aria-hidden="true">+</span><span class="loadout-tile-name">Empty</span>'}
function drawItems(){
  const node=$('#t-items');if(!node)return;
  const state=itemCompare,items=itemChoices(state.kind,false),addons=itemChoices(state.kind,true);
  if(!items.some(i=>i.id===state.item))state.item=items[0].id;
  state.addons=state.addons.map(id=>addons.some(a=>a.id===id)?id:'');
  if(!state.activeSlot)state.activeSlot='item';
  const selected=DBD_ITEMS.items.find(i=>i.id===state.item);
  const select=(key,value,choices)=>`<select data-item-setting="${key}">${choices.map(([v,n])=>`<option value="${v}" ${v===value?'selected':''}>${esc(n)}</option>`).join('')}</select>`;
  const slot=(key,label,item)=>`<div class="equipment-slot"><span class="equipment-label">${label}</span><div class="item-tile-wrap"><button class="loadout-tile rarity-${itemRarityClass(item)} ${state.activeSlot===key?'inventory-active':''}" data-item-action="slot" data-slot="${key}" aria-pressed="${state.activeSlot===key}" aria-label="Choose ${label}${item?': '+esc(item.name):''}">${itemTile(item)}</button>${itemInfo(item)}</div></div>`;
  node.innerHTML=`<div class="card item-workbench"><div class="loadout-heading"><div><span class="equipment-label">Survivor loadout</span><h2>Item calculator</h2></div><div class="seg"><button data-item-action="kind" data-kind="toolbox" aria-pressed="${state.kind==='toolbox'}">Toolboxes</button><button data-item-action="kind" data-kind="medkit" aria-pressed="${state.kind==='medkit'}">Med-kits</button></div></div>
  <p class="sub">Choose a slot, then equip an item or add-on from the inventory. Your stats update immediately.</p>
  <div class="equipment-rack">${slot('item','Item',selected)}<span class="equipment-plus" aria-hidden="true">+</span>${[0,1].map(i=>slot('addon'+i,'Add-on '+(i+1),DBD_ITEMS.items.find(a=>a.id===state.addons[i]))).join('')}</div>
  <div id="item-result" aria-live="polite"></div>
  <div class="inventory-heading"><h3>Inventory</h3><div class="seg"><button data-item-action="slot" data-slot="item" aria-pressed="${state.activeSlot==='item'}">Items</button><button data-item-action="slot" data-slot="addon0" aria-pressed="${state.activeSlot!=='item'}">Add-ons</button></div></div>
  <label>Search inventory<input id="item-inventory-search" type="search" value="${esc(state.inventoryQuery||'')}" placeholder="Search items or add-ons"></label><p id="item-inventory-label" class="sub"></p><div id="item-inventory" class="item-inventory"></div>
  <details class="item-conditions"><summary>Perks & calculation conditions</summary>
  <label class="effect-toggle"><input type="checkbox" data-item-setting="planner" ${state.planner&&role==='S'?'checked':''} ${role!=='S'?'disabled':''}>Include my survivor planner perks and activation conditions</label>
  <p class="sub">${state.planner&&role==='S'?`Using: ${esc(build.join(', ')||'no selected perks')}. Set health, tier and active effects in the planner.`:'Base item stats; planner perks are currently excluded.'}</p>
  ${state.kind==='toolbox'?'<label class="effect-toggle"><input type="checkbox" data-item-setting="installed" '+(state.installed?'checked':'')+'>Brand New Part successfully installed (installation time excluded)</label>':'<label class="effect-toggle"><input type="checkbox" data-item-setting="consume" '+(state.consume?'checked':'')+'>Activate a consuming add-on before healing (uses up the med-kit)</label>'}
  <small>Patch ${esc(DBD_ITEMS.version)}. Solo, uninterrupted use; no skill-check progression, recharge effects or killer debuffs.</small></details>
  <button class="btn ghost" data-item-action="pin">Pin this loadout for comparison</button><div id="item-pinned"></div></div>
  <details class="card" id="item-all-combinations" ${state.rankingsOpen?'open':''}><summary>Browse all item / add-on combinations</summary><div class="row"><label>Search combinations<input id="item-search" type="search" value="${esc(state.query)}" placeholder="e.g. Wire Spool"></label><label>Sort${select('sort',state.sort,[['time','Fastest completion'],['capacity','Most charges'],['rate','Fastest active speed']])}</label>${state.kind==='medkit'?`<label>Compare healing${select('action',state.action,[['others','Another survivor'],['self','Self-healing']])}</label>`:''}</div><div id="item-rankings"></div></details>`;
  node.onchange=e=>{
    const key=e.target.dataset.itemSetting;if(!key)return;
    state[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;state.page=0;drawItems();
  };
  node.onclick=e=>{
    const b=e.target.closest('[data-item-action]');if(!b)return;
    const action=b.dataset.itemAction;
    if(action==='slot'){state.activeSlot=b.dataset.slot;state.inventoryQuery='';drawItems();}
    if(action==='equip')equipInventoryItem(b.dataset.id);
    if(action==='kind'&&b.dataset.kind!==state.kind){state.kind=b.dataset.kind;state.item='';state.addons=['',''];state.pinned=null;state.activeSlot='item';state.inventoryQuery='';state.query='';state.consume=false;state.installed=false;state.page=0;drawItems();}
    if(action==='pin'){state.pinned={item:state.item,addons:[...state.addons]};drawItemResults();}
    if(action==='unpin'){state.pinned=null;drawItemResults();}
    if(action==='page'){state.page+=Number(b.dataset.step);drawItemRankings();}
    if(action==='inspect'){state.item=b.dataset.id;state.addons=JSON.parse(b.dataset.addons);drawItems();$('#item-result').scrollIntoView({block:'start',behavior:'smooth'});}
  };
  $('#item-inventory-search').oninput=e=>{state.inventoryQuery=e.target.value;drawItemInventory()};
  $('#item-search').oninput=e=>{state.query=e.target.value;state.page=0;drawItemRankings()};
  $('#item-all-combinations').ontoggle=e=>{state.rankingsOpen=e.currentTarget.open;if(state.rankingsOpen)drawItemRankings()};
  drawItemResults();drawItemInventory();if(state.rankingsOpen)drawItemRankings();
}
function equipInventoryItem(id){
  const state=itemCompare;
  if(state.activeSlot==='item'){
    if(!itemChoices(state.kind,false).some(i=>i.id===id))return;
    state.item=id;
  }else{
    const index=Number(state.activeSlot.slice(-1));
    if(id&&!itemChoices(state.kind,true).some(i=>i.id===id))return;
    state.addons[index]=id;
    if(id&&state.addons[1-index]===id)state.addons[1-index]='';
  }
  drawItems();
}
function drawItemInventory(){
  const state=itemCompare,isAddon=state.activeSlot!=='item',query=searchText(state.inventoryQuery||'');
  const choices=itemChoices(state.kind,isAddon).filter(i=>searchText(i.name+' '+i.rarity+' '+i.description).includes(query));
  $('#item-inventory-label').textContent=isAddon?'Equipping add-on '+(Number(state.activeSlot.slice(-1))+1)+'. Two different add-ons may be equipped.':'Select a '+(state.kind==='toolbox'?'toolbox':'med-kit')+'.';
  $('#item-inventory').innerHTML=(isAddon?`<button class="loadout-tile inventory-empty" data-item-action="equip" data-id="" aria-label="Remove this add-on"><span class="empty-item-slot" aria-hidden="true">×</span><span class="loadout-tile-name">Remove add-on</span></button>`:'')+choices.map(i=>{
    const equipped=isAddon?state.addons.includes(i.id):state.item===i.id;
    return `<div class="item-tile-wrap"><button class="loadout-tile rarity-${itemRarityClass(i)} ${equipped?'is-equipped':''}" data-item-action="equip" data-id="${i.id}" aria-pressed="${equipped}" title="${esc(i.name)} — ${esc(i.rarity)}">${itemTile(i)}${equipped?'<span class="equipped-mark" aria-hidden="true">✓</span>':''}</button>${itemInfo(i)}</div>`;
  }).join('')+(!choices.length?'<p class="sub">No matching items.</p>':'');
}
function itemResultHTML(result,title){
  const stat=(label,value,note='')=>`<div class="stat"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
  const chargeAddons=result.addons.filter(a=>a.effects.charges);
  const breakdown=`${result.item.effects.charges} base${chargeAddons.map(a=>' + '+a.effects.charges+' '+a.name).join('')}`;
  let cards,notes=[...result.notes];
  if(result.item.kind==='toolbox'){
    cards=stat('Repair speed',result.rate.toFixed(2)+' ch/s','+'+((result.rate-1)*100).toFixed(1)+'% vs standard solo repair')+
      stat('Full generator',result.time.toFixed(2)+' s','Toolbox first, then bare hands after depletion')+
      stat('Toolbox duration',result.itemSeconds.toFixed(2)+' s','Until all charges are used')+
      stat('Sabotage speed','+'+result.sabotage.toFixed(1)+'%','Action time × '+(1/(1+result.sabotage/100)).toFixed(3))+
      stat('Complete sabotages',result.sabotages,'6 charges per hook; use instead of repairing')+
      stat('Time saved',result.saved.toFixed(2)+' s','Compared with repairing without a toolbox');
  }else{
    const ids=result.addons.map(a=>a.id),options=comparisonOptions();
    const other=calculateItem(result.item.id,ids,{...options,action:'others'});
    const self=calculateItem(result.item.id,ids,{...options,action:'self'});
    const possible=r=>r.broken?'Blocked':r.time.toFixed(2)+' s';
    cards=stat('Heal another survivor',possible(other),other.rate.toFixed(2)+' healing charges/s')+
      stat('Self-heal',possible(self),self.rate.toFixed(2)+' healing charges/s · while injured')+
      stat('Charges / altruistic heal',other.cost.toFixed(2),other.fullHeals+' full heals available')+
      stat('Charges / self-heal',self.cost.toFixed(2),(self.broken?'Broken prevents self-healing':self.fullHeals+' full self-heals available'))+
      stat('Healing speed bonus','+'+((other.rate-1)*100).toFixed(1)+'%','For healing another survivor')+
      stat('Self-heal capacity',self.broken?'Blocked':self.heals.toFixed(2)+' states','Includes self-healing efficiency penalty');
    notes=[...new Set([...other.notes,...self.notes])];
    if(!other.canHeal)notes.push('Not enough usable charges to complete a heal on another survivor.');
    if(!self.canHeal)notes.push('Not enough usable charges, or Broken, prevents a full self-heal.');
  }
  return `<article class="loadout-results"><div class="selected-item-heading"><div><span class="equipment-label">${esc(title)}</span><h3>${esc(result.item.name)}</h3><p class="sub">${esc(result.addons.map(a=>a.name).join(' + ')||'No add-ons equipped')}</p></div><div class="charge-total"><b>${result.capacity}</b><span>Total charges</span></div></div>
  <p class="charge-breakdown">${esc(breakdown)}${result.consumed?' · consumed before healing':''}</p><div class="stats item-live-stats">${cards}</div>
  <details class="item-effect-details"><summary>Item effects & calculation details</summary>${[result.item,...result.addons].map(i=>`<p><b>${esc(i.name)}</b>: ${esc(i.description)}</p>`).join('')}
  ${notes.map(n=>`<p class="sub">${esc(n)}</p>`).join('')}${result.unsupported.length?`<p class="sub">Planner perks not modeled: ${esc(result.unsupported.join(', '))}.</p>`:''}
  <small>Add-on speed bonuses are not reduced by Diminishing Returns. Perk and item base bonuses use the shared stacking rules. No skill-check progression, recharging, interruptions, killer debuffs or automatic consumable timing is simulated. Healing times assume enough charges; the counts show how many complete heals this loadout can perform.</small></details></article>`;
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
