/* Five browser-local presets, scoped to the guest or signed-in account.
 * Match records always store a copy of perk names, never a mutable preset reference.
 */
let presetSlot=1,matchPerkDraft={role:'S',enabled:false,perks:[],source:''};
function presetKey(){return typeof FogAccounts==='undefined'?'fog.presets.guest':FogAccounts.presetStorageKey()}
function readPresets(){
  const records=store.get(presetKey(),[]);
  return Array.isArray(records)?records.filter(p=>p&&Number.isInteger(p.slot)&&p.slot>=1&&p.slot<=5&&['S','K'].includes(p.role)&&typeof p.name==='string'&&Array.isArray(p.perks)&&p.perks.length>=1&&p.perks.length<=4&&p.perks.every(n=>typeof n==='string')):[];
}
function writePresets(records){
  if(typeof FogAccounts!=='undefined'&&!FogAccounts.canManagePresets())throw Error('Wait for your account to finish loading.');
  if(records.length>5||new Set(records.map(p=>p.slot)).size!==records.length)throw Error('Use up to five preset slots.');
  localStorage.setItem(presetKey(),JSON.stringify(records));
}
function saveBuildPreset(slot,name,names=build,r=role){
  if(!Number.isInteger(slot)||slot<1||slot>5)throw Error('Choose preset slot 1–5.');
  if(!names.length||names.length>4||new Set(names).size!==names.length||names.some(n=>!PERKS[r].some(p=>p[0]===n)))throw Error('Choose one to four different perks for this role in the planner first.');
  name=name.trim()||RN[r]+' build '+slot;if(name.length>40)throw Error('Use up to 40 characters for a preset name.');
  const next={slot,name,role:r,perks:[...names]};
  writePresets([...readPresets().filter(p=>p.slot!==slot),next].sort((a,b)=>a.slot-b.slot));
}
function loadBuildPreset(slot){
  const preset=readPresets().find(p=>p.slot===slot);if(!preset)return;
  role=preset.role;build=preset.perks.filter(n=>PERKS[role].some(p=>p[0]===n));q='';drawBuild();showTab('build');
}
function drawPresetManager(){
  const node=$('#preset-manager');if(!node)return;
  const presets=readPresets(),selected=presets.find(p=>p.slot===presetSlot);
  const disabled=typeof FogAccounts!=='undefined'&&!FogAccounts.canManagePresets();
  node.innerHTML=`<p class="sub">Save up to five builds total across both roles. Presets stay in this browser, separately for each signed-in account or guest. Match logs keep their own copy of the perks.</p><div class="row"><label>Preset slot<select id="preset-slot">${[1,2,3,4,5].map(slot=>{const p=presets.find(p=>p.slot===slot);return `<option value="${slot}" ${slot===presetSlot?'selected':''}>${slot}. ${p?esc(p.name)+' ('+RN[p.role]+')':'Empty slot'}</option>`}).join('')}</select></label><label>Build name<input id="preset-name" maxlength="40" placeholder="e.g. Chase build" value="${esc(selected?.name||'')}"></label></div>${selected?`<p>${esc(selected.perks.join(' · '))}</p>`:''}<div class="row"><button class="btn" data-preset="save" ${disabled||!build.length?'disabled':''}>${selected?'Replace with':'Save'} current ${RN[role].toLowerCase()} build</button><button class="btn ghost" data-preset="load" ${disabled||!selected?'disabled':''}>Load into planner</button><button class="btn ghost" data-preset="delete" ${disabled||!selected?'disabled':''}>Delete preset</button></div><p id="preset-status" role="status"></p>`;
  $('#preset-slot').onchange=e=>{presetSlot=Number(e.target.value);drawPresetManager()};
  node.onclick=e=>{
    const action=e.target.closest('[data-preset]')?.dataset.preset;if(!action)return;
    try{
      if(action==='save'){saveBuildPreset(presetSlot,$('#preset-name').value);drawPresetManager();drawMatchPerks();$('#preset-status').textContent='Preset saved.';}
      if(action==='load')loadBuildPreset(presetSlot);
      if(action==='delete'){writePresets(readPresets().filter(p=>p.slot!==presetSlot));drawPresetManager();drawMatchPerks();$('#preset-status').textContent='Preset deleted.';}
    }catch(error){$('#preset-status').textContent=error.message}
  };
}
function drawMatchPerks(){
  const node=$('#match-perk-fields');if(!node)return;
  if(matchPerkDraft.role!==tr)matchPerkDraft={role:tr,enabled:false,perks:[],source:''};
  node.hidden=!matchPerkDraft.enabled;
  if(!matchPerkDraft.enabled){node.innerHTML='';return;}
  const presets=readPresets().filter(p=>p.role===tr);
  node.innerHTML=`<label>Use a build<select id="match-build-source"><option value="">Custom / one-off build</option><option value="planner" ${role!==tr||!build.length?'disabled':''}>Current planner build</option>${presets.map(p=>`<option value="preset:${p.slot}">${esc(p.name)}</option>`).join('')}</select></label><div class="slots">${[0,1,2,3].map(i=>`<label>Perk ${i+1}<select id="match-perk-${i}" data-match-perk="${i}"><option value="">Empty / unknown</option>${PERKS[tr].map(([n])=>`<option value="${esc(n)}" ${matchPerkDraft.perks[i]===n?'selected':''}>${esc(n)} — ${esc(perkOwner(n))}</option>`).join('')}</select></label>`).join('')}</div><p class="sub">You can edit any selection without changing a saved preset.</p>`;
  $('#match-build-source').value=matchPerkDraft.source;
  $('#match-build-source').onchange=e=>{
    const source=e.target.value;
    if(source==='planner')matchPerkDraft.perks=role===tr?[...build]:[];
    else if(source.startsWith('preset:')){
      const p=readPresets().find(p=>p.slot===Number(source.slice(7))&&p.role===tr);matchPerkDraft.perks=p?[...p.perks]:[];
    }
    matchPerkDraft.source=source;drawMatchPerks();
  };
  node.onchange=e=>{if(e.target.dataset.matchPerk!==undefined){matchPerkDraft.perks[Number(e.target.dataset.matchPerk)]=e.target.value;matchPerkDraft.source='';$('#match-build-source').value='';}};
}
function recordedMatchPerks(){
  if(!$('#fp').checked)return [];
  const names=[0,1,2,3].map(i=>$('#match-perk-'+i).value).filter(Boolean);
  if(new Set(names).size!==names.length)throw Error('Choose different perks in each slot.');
  if(names.some(n=>!PERKS[tr].some(p=>p[0]===n)))throw Error('Choose perks for the selected match role.');
  return names;
}
