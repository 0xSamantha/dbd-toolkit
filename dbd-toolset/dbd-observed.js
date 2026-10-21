/* Observed loadouts are independent of own-match history and statistics. */
let observedBuilds=[],observedRole='S',observedQuery='',observedFilter='all',observedEditing=null;
function validateObserved(value){
  if(!value||!Number.isSafeInteger(value.id)||value.id<1||!['S','K'].includes(value.role)||
    typeof value.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||
    typeof value.player!=='string'||value.player.length>80||typeof value.character!=='string'||value.character.length>80||
    typeof value.notes!=='string'||value.notes.length>1000||!Array.isArray(value.perks)||value.perks.length>4||
    value.perks.some(n=>typeof n!=='string'||n.length>120)||new Set(value.perks).size!==value.perks.length)throw Error('Check the build date, role, player, character, notes and up to four different perks.');
  return {id:value.id,date:value.date,role:value.role,player:value.player,character:value.character,perks:[...value.perks],notes:value.notes};
}
function observedStatus(){return typeof FogAccounts==='undefined'?'Guest mode: saved separately in this browser.':FogAccounts.observedMode()}
function setObservedRole(r){observedRole=r;observedEditing=null;drawObserved()}
function drawObserved(){
  const node=$('#t-observed');if(!node)return;
  const editing=observedBuilds.find(b=>b.id===observedEditing);
  const values=editing||{date:(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})(),player:'',character:'',perks:[],notes:''};
  node.innerHTML=`<div class="card"><h2>Builds you’ve seen</h2><p class="sub">Keep notes on other players’ loadouts. These entries never count toward your own match stats or most-used perks.</p><p class="sub" id="observed-status">${esc(observedStatus())}</p>
  ${seg(observedRole,'setObservedRole')}<form id="observed-form"><div class="row"><label>Date<input name="date" type="date" value="${esc(values.date)}" required></label><label>Player / label (optional)<input name="player" maxlength="80" value="${esc(values.player)}" placeholder="Nickname or a label for this build"></label><label>Character (optional)<input name="character" maxlength="80" value="${esc(values.character)}"></label></div>
  <div class="slots">${[0,1,2,3].map(i=>`<label>Perk ${i+1}<select name="perk${i}"><option value="">Unknown / empty</option>${PERKS[observedRole].map(([name])=>`<option value="${esc(name)}" ${values.perks[i]===name?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`).join('')}</div>
  <label>Notes<textarea name="notes" maxlength="1000" placeholder="Where you saw it, how it played, or why it stood out">${esc(values.notes)}</textarea></label><div class="row"><button class="btn" type="submit">${editing?'Update entry':'Save observed build'}</button>${editing?'<button class="btn ghost" type="button" data-observed="cancel">Cancel edit</button>':''}</div></form></div>
  <div class="card"><h2>Observed build history</h2><div class="row"><label>Search<input id="observed-search" type="search" placeholder="Player, character, perk or notes" value="${esc(observedQuery)}"></label><label>Role<select id="observed-filter">${[['all','All'],['S','Survivor'],['K','Killer']].map(([v,n])=>`<option value="${v}" ${v===observedFilter?'selected':''}>${n}</option>`).join('')}</select></label></div><div id="observed-results"></div></div>
  <details class="card"><summary>Back up or import observed builds</summary><p class="sub">This backup is separate from match-history JSON. Imports merge by entry ID.</p><textarea id="observed-io" aria-label="Observed build backup JSON"></textarea><div class="row"><button class="btn ghost" data-observed="export">Export</button><button class="btn ghost" data-observed="import">Import</button><button class="btn ghost" data-observed="upload">Copy guest build log into my account</button></div></details>`;
  $('#observed-form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,fields=form.elements;
    const rec={id:observedEditing||Date.now(),date:fields.date.value,role:observedRole,player:fields.player.value.trim(),character:fields.character.value.trim(),notes:fields.notes.value.trim(),perks:[0,1,2,3].map(i=>fields['perk'+i].value).filter(Boolean)};
    const button=form.querySelector('button[type=submit]');button.disabled=true;
    try{await FogAccounts.saveObserved(validateObserved(rec));observedEditing=null;drawObserved()}catch(error){$('#observed-status').textContent='Not saved: '+error.message;button.disabled=false}
  };
  $('#observed-search').oninput=e=>{observedQuery=e.target.value;drawObservedResults()};
  $('#observed-filter').onchange=e=>{observedFilter=e.target.value;drawObservedResults()};
  node.onclick=async e=>{
    const button=e.target.closest('[data-observed]');if(!button)return;
    const action=button.dataset.observed,id=Number(button.dataset.id);
    try{
      if(action==='edit'){const rec=observedBuilds.find(b=>b.id===id);observedEditing=id;observedRole=rec.role;drawObserved();$('#observed-form').scrollIntoView({block:'start',behavior:'smooth'})}
      if(action==='cancel'){observedEditing=null;drawObserved()}
      if(action==='delete'&&confirm('Delete this observed build?')){await FogAccounts.deleteObserved(id);if(observedEditing===id)observedEditing=null;drawObserved()}
      if(action==='planner'){const rec=observedBuilds.find(b=>b.id===id);role=rec.role;build=rec.perks.filter(n=>PERKS[role].some(p=>p[0]===n));q='';drawBuild();showTab('build')}
      if(action==='export'){$('#observed-io').value=JSON.stringify(observedBuilds,null,2)}
      if(action==='import'){await FogAccounts.importObserved(JSON.parse($('#observed-io').value));drawObserved()}
      if(action==='upload'){await FogAccounts.copyGuestObserved();drawObserved()}
    }catch(error){$('#observed-status').textContent=error.message}
  };
  drawObservedResults();
}
function drawObservedResults(){
  const query=searchText(observedQuery);
  const list=observedBuilds.filter(b=>(observedFilter==='all'||b.role===observedFilter)&&searchText([b.player,b.character,b.notes,...b.perks].join(' ')).includes(query)).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  $('#observed-results').innerHTML=list.length?list.map(b=>`<article class="card"><p><b>${esc(b.player||'Unnamed player')}</b> · ${esc(b.character||RN[b.role])} · ${esc(b.date)}</p><div class="observed-perks">${b.perks.map(n=>`<div>${perkIcon(n)}<span>${esc(n)}</span>${perkInfo(n)}</div>`).join('')||'<p>No confirmed perks recorded.</p>'}</div><p class="saved-notes">${esc(b.notes)}</p><div class="row">${[['edit','Edit'],['planner','Open in planner'],['delete','Delete']].map(([action,label])=>`<button class="btn ghost" data-observed="${action}" data-id="${b.id}">${label}</button>`).join('')}</div></article>`).join(''):'<p class="sub">No observed builds found.</p>';
}
