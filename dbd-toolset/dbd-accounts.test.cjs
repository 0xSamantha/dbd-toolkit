const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {transferKey,toGeneralMatch}=require('./hardcore-model.js');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const record=(id,notes='')=>({id,date:'2026-10-20',role:'S',character:'Meg',result:'Escaped',perks:[],notes});
async function main(){
 const nodes=new Map(),stored=new Map(),session=new Map(),tasks=[];
 const get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'0',focus(){},setAttribute(){},elements:{email:{value:'test@example.com',checkValidity:()=>true},password:{value:'test password 123'},displayName:{value:''}}});return nodes.get(s)};
 let current=null,listener=null,failWrites=false,missingObserved=false,signupPayload=null,resetRequest=null,passwordUpdate=null,userReads=0;
 const rows=new Map(),observedRows=new Map(),presetRows=new Map();
 function query(table){
  const rowset=table==='matches'?rows:table==='build_presets'?presetRows:observedRows;
  const filters={};let operation='select',offset=0,end=499;
  const q={select(){return q},delete(){operation='delete';return q},eq(k,v){filters[k]=v;return q},order(){return q},range(a,b){offset=a;end=b;return q},then(resolve,reject){
   return Promise.resolve().then(()=>{
    assert.equal(filters.user_id,current.id,'Queries must explicitly scope the signed-in owner');
    if(table==='observed_builds'&&missingObserved)return {data:null,error:Error('observed_builds does not exist')};
    if(operation==='delete')rowset.delete(current.id+':'+(filters.id??filters.slot));
    return {data:[...rowset.values()].filter(r=>r.user_id===current.id).sort((a,b)=>b.id-a.id).slice(offset,end+1),error:null};
   }).then(resolve,reject);
  }};return q;
 }
 const client={auth:{
  onAuthStateChange(fn){listener=fn;fn('INITIAL_SESSION',null)},
  async getUser(){userReads++;return {data:{user:current},error:null}},
  async signUp(payload){signupPayload=payload;return {data:{user:null,session:null},error:null}},
  async resetPasswordForEmail(email,options){resetRequest={email,redirectTo:options.redirectTo};return {error:null}},
  async updateUser({password}){passwordUpdate=password;return {error:null}},
  async signOut(){current=null;listener('SIGNED_OUT',null);return {error:null}},
 },from(name){assert(['matches','observed_builds','build_presets'].includes(name));const rowset=name==='matches'?rows:name==='build_presets'?presetRows:observedRows;return {...query(name),async insert(row){
   assert.equal(row.user_id,current.id);
   const key=row.user_id+':'+row.id;
   if(rowset.has(key))return {error:Error('Duplicate ID')};
   rowset.set(key,row);return {error:null};
 },async upsert(payload,options={}){
   if(failWrites)return {error:Error('Offline')};
   for(const row of Array.isArray(payload)?payload:[payload]){assert.equal(row.user_id,current.id);const key=row.user_id+':'+(row.id??row.slot);if(!options.ignoreDuplicates||!rowset.has(key))rowset.set(key,row)}return {error:null};
 }}}};
 const context=vm.createContext({console,setTimeout:fn=>tasks.push(fn),window:{addEventListener(){},FOG_AUTH_CONFIG:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test',redirectUrl:'http://localhost:8000/dbd-toolkit.html'},supabase:{createClient:()=>client}},
  document:{querySelector:get,addEventListener(){},createElement:()=>({}),head:{appendChild:script=>script.onload()}},
  location:{hash:''},sessionStorage:{getItem:k=>session.get(k)||null,removeItem:k=>session.delete(k)},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},setInterval(){return 1},clearInterval(){}});
 const run=s=>vm.runInContext(s,context);
 for(const name of ['dbd-perks.js','dbd-stats.js','dbd-items-data.js','dbd-items.js','dbd-observed.js','dbd-presets.js','dbd-metrics.js'])vm.runInContext(read(name),context);
 assert(read('dbd-toolkit.html').includes('dbd-accounts.js?v=cloud-presets-1'));
 run('globalThis.dataLayer=window.dataLayer=[]');
 const inline=[...read('dbd-toolkit.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');run(inline);
 run(read('dbd-accounts.js'));
 context.fieldRecord={...record(123),map:'Coal Tower',opposingKiller:'The Clown',durationMs:42000,observed:{character:'The Clown',perks:['Pop Goes the Weasel']}};
 assert.equal(run('FogAccounts.validateMatch(fieldRecord).durationMs'),42000);
 assert.equal(run('FogAccounts.validateMatch(fieldRecord).observed.perks[0]'),'Pop Goes the Weasel');
 assert.equal(run('FogAccounts.validateMatch(fieldRecord).map'),'Coal Tower');
 assert.equal(run('FogAccounts.validateMatch(fieldRecord).opposingKiller'),'The Clown');
 for(const field of ['map','opposingKiller']){
  context.badFieldRecord={...record(123),[field]:42};
  assert.throws(()=>run('FogAccounts.validateMatch(badFieldRecord)'),/Invalid match/);
  context.badFieldRecord={...record(123),[field]:'x'.repeat(81)};
  assert.throws(()=>run('FogAccounts.validateMatch(badFieldRecord)'),/Invalid match/);
 }

 const flush=async()=>{for(let i=0;i<20;i++){await Promise.resolve();while(tasks.length)tasks.shift()();}};
 await flush();
 assert(get('#t-account').innerHTML.includes('Forgot password?'));
 await get('#t-account').onclick({target:{closest:()=>({dataset:{account:'reset'}})}});
 assert.deepEqual(resetRequest,{email:'test@example.com',redirectTo:'http://localhost:8000/dbd-toolkit.html'});
 assert.match(get('#t-account').innerHTML,/If an account exists/);
 current={id:'recovery-user',email:'test@example.com',email_confirmed_at:'2026-10-20'};
 listener('PASSWORD_RECOVERY',{user:current});await flush();
 assert.equal(get('#t-account').hidden,false);
 assert.match(get('#t-account').innerHTML,/Choose a new password/);
 const recoveryForm=get('#password-recovery-form');
 recoveryForm.elements.confirmation={value:'different password'};
 await recoveryForm.onsubmit({preventDefault(){}});
 assert.equal(passwordUpdate,null);
 recoveryForm.elements.confirmation.value=recoveryForm.elements.password.value;
 await recoveryForm.onsubmit({preventDefault(){}});
 assert.equal(passwordUpdate,recoveryForm.elements.password.value);
 assert.match(get('#t-account').innerHTML,/Password updated/);
 current=null;listener('SIGNED_OUT',null);await flush();
 await run('FogAccounts.saveMatch({...fieldRecord,perks:["Bond"]})');
 let editDialogOpens=0;
 get('#match-edit-dialog').showModal=()=>{editDialogOpens++};

 run('editMatch(123)');
 assert.equal(editDialogOpens,1,'Edit must open the selected entry in a dialog');
 assert(get('#t-track').innerHTML.includes('Edit match — Meg · 2026-10-20'));
 assert.equal(get('#fc').value,'Meg');
 assert.equal(get('#fm').value,'Coal Tower');
 assert.equal(get('#fk').value,'The Clown');
 assert.equal(run('matchPerkDraft.perks[0]'),'Bond');
 get('#fn').value='Updated later';
 run('cancelMatchEdit()');
 assert.equal(run('matches.find(m=>m.id===123).notes'),'','Cancel must not mutate saved records');
 run('editMatch(123)');
 get('#fn').value='Updated later';get('#fm').value='Gas Heaven';
 get('#match-perk-0').value='Bond';get('#match-perk-1').value='Lithe';
 get('#match-perk-2').value='';get('#match-perk-3').value='';
 await run('save()');
 assert.equal(run('matches.filter(m=>m.id===123).length'),1,'Editing must update, not duplicate');
 assert.equal(run('matches.find(m=>m.id===123).notes'),'Updated later');
 assert.equal(run('matches.find(m=>m.id===123).map'),'Gas Heaven');
 assert.equal(run('matches.find(m=>m.id===123).perks.join(",")'),'Bond,Lithe');
 assert.equal(run('editingMatch'),null);
 run('editMatch(123);matches=[];drawTrack()');
 assert.equal(run('editingMatch'),null,'Switching logs must clear the edit target');
 await run('FogAccounts.deleteMatch(123)');
 run('showTab("track")');
 get('#fc').value='';
 get('#fd').value='2026-10-20';
 run('startGeneralMatch()');
 assert.equal(run('matchTimer().character'),'');
 get('#fc').value='Meg';
 get('#fc').onchange();
 assert.equal(run('matchTimer().character'),'Meg Thomas');
 assert.equal(get('#match-result-fields').hidden,true);
 run('drawTrack()');
 assert.match(get('#match-perk-fields').innerHTML,/Perk 1/);
 get('#match-perk-1').value='Hope';
 get('#match-perk-fields').onchange({target:{dataset:{matchPerk:'1'},value:'Hope'}});
 assert.equal(run('matchTimer().perks[1]'),'Hope');
 run('endGeneralMatch()');
 assert.equal(get('#match-result-fields').hidden,false);
 get('#fr').value='Escaped';
 get('#match-observed-character').value='The Clown';
 for(let i=0;i<4;i++)get('#match-observed-perk-'+i).value=i===0?'Pop Goes the Weasel':'';
 const timedId=run('matchTimer().startedAt');
 await run('save()');
 assert.equal(run('matchTimer()'),null);
 assert.equal(run(`matches.find(m=>m.id===${timedId}).character`),'Meg Thomas');
 assert.equal(run(`matches.find(m=>m.id===${timedId}).perks.join("|")`),'Bond|Hope');
 assert.equal(run(`matches.find(m=>m.id===${timedId}).observed.character`),'The Clown');
 assert.match(get('#t-track').innerHTML,/class="match-history-actions"[^]*>Edit<\/button>[^]*>Delete<\/button>/);
 assert.equal(run(`Number.isSafeInteger(matches.find(m=>m.id===${timedId}).durationMs)`),true);
 await run(`FogAccounts.deleteMatch(${timedId})`);
 assert(get('#t-account').innerHTML.includes('Display name (optional, for registration)'));
 for(const role of ['S','K'])for(const result of ['Draw','Surrendered']){context.extraRecord={...record(50),role,result};assert.equal(run('FogAccounts.validateMatch(extraRecord).result'),result);}
 get('#account-form').elements.displayName.value='  Samantha  ';
 await get('#account-form').onsubmit({preventDefault(){},submitter:{dataset:{mode:'signup'}}});
 assert.equal(signupPayload.options.data.display_name,'Samantha');
 assert.equal(signupPayload.options.emailRedirectTo,'http://localhost:8000/dbd-toolkit.html');
 get('#account-form').elements.displayName.value='';
 await get('#account-form').onsubmit({preventDefault(){},submitter:{dataset:{mode:'signup'}}});
 assert.equal(Object.keys(signupPayload.options.data).length,0);
 get('#account-form').elements.displayName.value='x'.repeat(41);signupPayload=null,resetRequest=null,passwordUpdate=null,userReads=0;
 await get('#account-form').onsubmit({preventDefault(){},submitter:{dataset:{mode:'signup'}}});
 assert.equal(signupPayload,null);
 get('#account-form').elements.displayName.value='';
 run('saveBuildPreset(1,"Guest build",["Bond"],"S")');
 context.record=record(1,'guest');await run('FogAccounts.saveMatch(record)');assert(stored.get('fog.matches').includes('guest'));
 await assert.rejects(run('FogAccounts.importMatches([{id:1}])'),/Invalid match/);
 run('libraryQuery="deja vu";drawLibraryResults()');assert(get('#library-results').innerHTML.includes('Déjà Vu'));
 run('libraryQuery="";setLibraryRole("K")');assert.equal((get('#library-results').innerHTML.match(/class="library-perk"/g)||[]).length,145);
 run('setLibraryRole("S")');assert.equal((get('#library-results').innerHTML.match(/class="library-perk"/g)||[]).length,176);
 const observed={id:10,date:'2026-10-21',role:'K',player:'Observed player',character:'Nurse',perks:['Whispers'],notes:'Interesting build'};
 context.observed=observed;await run('FogAccounts.saveObserved(observed)');
 assert(stored.get('fog.observedBuilds').includes('Observed player'));
 assert.equal(run('matches.length'),1,'Observed records must not change own-match counts');
 await assert.rejects(run('FogAccounts.importObserved([{id:1}])'),/Check the build/);
 current={id:'account-a',email:'a@example.com',email_confirmed_at:'2026-10-20',user_metadata:{display_name:'<Samantha>'}};listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('readPresets().length'),0,'Guest presets must not appear in account A');
 await run('saveBuildPreset(1,"A build",["Bond"],"S")');
 assert.equal(presetRows.get('account-a:1').name,'A build');
 stored.set('fog.presets.account-a',JSON.stringify([
  {slot:1,name:'Older local build',role:'S',perks:['Hope']},
  {slot:2,name:'Laptop build',role:'S',perks:['Lithe']}
 ]));
 listener('SIGNED_OUT',null);await flush();
 listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('readPresets().map(p=>p.name).join("|")'),'A build|Laptop build|Older local build');
 stored.delete('fog.presets.account-a');
 listener('SIGNED_OUT',null);await flush();
 listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('readPresets().map(p=>p.name).join("|")'),'A build|Laptop build|Older local build');
 assert.equal(run('matches.length'),0,'Guest logs must not be silently uploaded');
 assert(get('#t-account').innerHTML.includes('&lt;Samantha&gt;'));
 assert(!get('#t-account').innerHTML.includes('<Samantha>')); 
 assert.equal(get('#account-prompt').hidden,true,'Hide registration prompt for signed-in users');
 assert.equal(run('observedBuilds.length'),0,'Guest builds must not be silently uploaded');
 const hardcoreRecord=toGeneralMatch({
  id:'08a4ee31-5f37-4261-be37-eaa9dd623158',title:'One-life challenge',
  matches:[{at:'2026-10-22T12:00:00Z',character:'Meg Thomas',outcome:'Sacrificed',queue:'team',
    killer:'The Trapper',map:'Coal Tower',perks:['Bond'],durationMs:42000,cause:'Hook'}]
 },0);
 session.set(transferKey,JSON.stringify(hardcoreRecord));
 get('input[name="hardcore-transfer-queue"]:checked').value='team';
 await run('saveHardcoreMatch({disabled:false})');
 const importedHardcore=rows.get('account-a:'+hardcoreRecord.id).data;
 assert.equal(importedHardcore.result,'Died');
 assert.equal(importedHardcore.queue,'team');
 assert.equal(importedHardcore.durationMs,42000);
 assert.match(importedHardcore.notes,/Sacrificed/);
 assert.equal(session.has(transferKey),false);
 session.set(transferKey,JSON.stringify(hardcoreRecord));
 await run('saveHardcoreMatch({disabled:false})');
 assert.match(get('#hardcore-transfer-status').textContent,/already/);
 session.delete(transferKey);
 run(`editMatch(${hardcoreRecord.id})`);
 assert.match(get('#t-track').innerHTML,/name="match-queue" value="team"\s+checked/);
 run('cancelMatchEdit()');
 await run(`FogAccounts.deleteMatch(${hardcoreRecord.id})`);
 // Exercise the cloud serialization and reload path, not just the in-memory form.
 await run('FogAccounts.saveMatch({...fieldRecord,notes:"Keep these notes",perks:["Bond"]})');
 assert.equal(rows.get('account-a:123').data.map,'Coal Tower');
 assert.equal(rows.get('account-a:123').data.opposingKiller,'The Clown');
 context.newerMatch={...record(110),date:'2026-10-21'};
 await run('FogAccounts.saveMatch(newerMatch)');
 listener('SIGNED_OUT',null);await flush();
 listener('SIGNED_IN',{user:current});await flush();
 run('editMatch(123)');
 assert.equal(get('#fm').value,'Coal Tower','Cloud reload must restore the map in the editor');
 assert.equal(get('#fk').value,'The Clown','Cloud reload must restore the opposing killer');
 assert.equal(get('#fn').value,'Keep these notes');
 assert.equal(run('matchPerkDraft.perks[0]'),'Bond');
 get('#match-perk-0').value='Bond';
 get('#match-perk-1').value='';get('#match-perk-2').value='';get('#match-perk-3').value='';
 get('#fn').value='Only the notes changed';
 const readsBeforeFocus=userReads;
 const editBeforeFocus=run('editingMatch');
 listener('SIGNED_IN',{user:current});await flush();
 assert.equal(userReads,readsBeforeFocus,'Focus event must reuse the active account');
 assert.equal(run('editingMatch'),editBeforeFocus,'Focus event must keep the edit open');
 assert.equal(get('#fn').value,'Only the notes changed');
 await run('save()');
 listener('SIGNED_IN',{user:current});await flush();
 run('editMatch(123)');
 assert.equal(get('#fm').value,'Coal Tower','Editing notes must preserve the map');
 assert.equal(get('#fk').value,'The Clown','Editing notes must preserve the opposing killer');
 assert.equal(get('#fn').value,'Only the notes changed');
 assert.equal(run('matches.map(m=>m.id).join(",")'),'110,123','Editing notes must preserve chronological order');
 get('#fd').value='2026-10-22';
 await run('save()');
 assert.equal(run('matches.map(m=>m.id).join(",")'),'123,110','Editing a date must move the match to the new day');
 await run('FogAccounts.deleteMatch(123);');await run('FogAccounts.deleteMatch(110);');

 context.observed={...observed,id:11,player:'Account A observed'};await run('FogAccounts.saveObserved(observed)');
 assert(observedRows.has('account-a:11'));assert(!rows.has('account-a:11'));
 assert(!stored.get('fog.observedBuilds').includes('Account A observed'));
 context.record=record(2,'account A');await run('FogAccounts.saveMatch(record)');assert.equal(rows.get('account-a:2').data.notes,'account A');
 assert(!stored.get('fog.matches').includes('account A'),'Cloud rows must not enter guest storage');
 failWrites=true;context.record=record(3,'offline');await assert.rejects(run('FogAccounts.saveMatch(record)'),/Offline/);assert.equal(run('matches.length'),1);failWrites=false;
 current={id:'account-b',email:'b@example.com',email_confirmed_at:'2026-10-20'};listener('SIGNED_IN',{user:current});await flush();assert.equal(run('matches.length'),0);
 assert.equal(run('readPresets().length'),0,'Account B must not see account A presets');
 assert.equal(run('observedBuilds.length'),0,'Account B must not see account A observed builds');
 context.observed={...observed,id:12};await run('FogAccounts.saveObserved(observed)');await run('FogAccounts.deleteObserved(12)');assert(!observedRows.has('account-b:12'));assert(observedRows.has('account-a:11'));
 context.record=record(4,'account B');await run('FogAccounts.saveMatch(record)');await run('FogAccounts.deleteMatch(4)');assert(!rows.has('account-b:4'));assert(rows.has('account-a:2'));
 current=null;listener('SIGNED_OUT',null);await flush();assert.equal(get('#account-prompt').hidden,false,'Restore registration prompt after sign-out');assert.equal(run('readPresets()[0].name'),'Guest build');assert.equal(run('matches[0].notes'),'guest');assert.equal(run('observedBuilds[0].id'),10);
 missingObserved=true;current={id:'account-a',email:'a@example.com',email_confirmed_at:'2026-10-20'};listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('matches.length'),1,'Missing observed migration must not break own match history');
 await assert.rejects(run('FogAccounts.saveObserved(observed)'),/unavailable/);
 missingObserved=false;
 current={id:'unverified',email:'c@example.com',email_confirmed_at:null};listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('matches.length'),0);await assert.rejects(run('FogAccounts.saveMatch(record)'),/wait/);
 assert(get('#t-account').innerHTML.includes('verify your email'));
 run(read('dbd-admin.js'));
 assert.equal(run('FogAccounts.isAdmin()'),false);
 assert.equal(get('#tab-admin').hidden,true);
 current={id:'16a1ddb9-7ebe-4281-a3f7-494c4da72166',email:'owner@example.com',email_confirmed_at:'2026-10-22'};
 listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('FogAccounts.isAdmin()'),true);
 assert.equal(get('#tab-admin').hidden,false);
 run('showTab("admin")');
 assert(get('#t-admin').innerHTML.includes('Site analytics'));
 client.functions={invoke:async(name,{body})=>{
  assert.equal(name,'admin-analytics');assert.equal(body.days,30);
  return {data:{totals:{visitors:10,views:25,sessions:12},
   locations:[{country:'<script>bad</script>',region:'California',visitors:8}],
   daily:[{date:'20261021',visitors:10,views:25,sessions:12}],
   generatedAt:'2026-10-22T00:00:00Z',timezone:'America/Los_Angeles'},error:null};
 }};
 await get('#admin-refresh').onclick();
 assert(get('#admin-report').innerHTML.includes('2026-10-21'));
 assert(get('#admin-report').innerHTML.includes('&lt;script&gt;bad&lt;/script&gt;'));
 assert(!get('#admin-report').innerHTML.includes('<script>'));

 current=null;listener('SIGNED_OUT',null);await flush();
 assert.equal(get('#tab-admin').hidden,true);
 assert.equal(get('#t-admin').innerHTML,'');
 assert.equal(get('#t-admin').hidden,true);
 console.log('PASS: library search and role counts; account/observed-build isolation; missing-migration fallback; guest preservation; offline write failure; deletion ownership; unverified-user write blocking. Live database RLS and email delivery still require project setup.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
