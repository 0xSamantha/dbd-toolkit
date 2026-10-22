const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
const record=(id,notes='')=>({id,date:'2026-10-20',role:'S',character:'Meg',result:'Escaped',perks:[],notes});
async function main(){
 const nodes=new Map(),stored=new Map(),tasks=[];
 const get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',value:'0',setAttribute(){},elements:{email:{value:'test@example.com',checkValidity:()=>true},password:{value:'test password 123'},displayName:{value:''}}});return nodes.get(s)};
 let current=null,listener=null,failWrites=false,missingObserved=false,signupPayload=null;
 const rows=new Map(),observedRows=new Map();
 function query(table){
  const rowset=table==='matches'?rows:observedRows;
  const filters={};let operation='select',offset=0,end=499;
  const q={select(){return q},delete(){operation='delete';return q},eq(k,v){filters[k]=v;return q},order(){return q},range(a,b){offset=a;end=b;return q},then(resolve,reject){
   return Promise.resolve().then(()=>{
    assert.equal(filters.user_id,current.id,'Queries must explicitly scope the signed-in owner');
    if(table==='observed_builds'&&missingObserved)return {data:null,error:Error('observed_builds does not exist')};
    if(operation==='delete')rowset.delete(current.id+':'+filters.id);
    return {data:[...rowset.values()].filter(r=>r.user_id===current.id).sort((a,b)=>b.id-a.id).slice(offset,end+1),error:null};
   }).then(resolve,reject);
  }};return q;
 }
 const client={auth:{
  onAuthStateChange(fn){listener=fn;fn('INITIAL_SESSION',null)},
  async getUser(){return {data:{user:current},error:null}},
  async signUp(payload){signupPayload=payload;return {data:{user:null,session:null},error:null}},
  async signOut(){current=null;listener('SIGNED_OUT',null);return {error:null}},
 },from(name){assert(['matches','observed_builds'].includes(name));const rowset=name==='matches'?rows:observedRows;return {...query(name),async upsert(payload){
   if(failWrites)return {error:Error('Offline')};
   for(const row of Array.isArray(payload)?payload:[payload]){assert.equal(row.user_id,current.id);rowset.set(row.user_id+':'+row.id,row)}return {error:null};
 }}}};
 const context=vm.createContext({console,setTimeout:fn=>tasks.push(fn),window:{addEventListener(){},FOG_AUTH_CONFIG:{url:'https://test.supabase.co',publishableKey:'sb_publishable_test',redirectUrl:'http://localhost:8000/dbd-toolkit.html'},supabase:{createClient:()=>client}},
  document:{querySelector:get,addEventListener(){},createElement:()=>({}),head:{appendChild:script=>script.onload()}},
  location:{hash:''},localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},setInterval(){}});
 const run=s=>vm.runInContext(s,context);
 for(const name of ['dbd-perks.js','dbd-stats.js','dbd-items-data.js','dbd-items.js','dbd-observed.js'])vm.runInContext(read(name),context);
 const inline=[...read('dbd-toolkit.html').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');run(inline);
 run(read('dbd-accounts.js'));
 const flush=async()=>{for(let i=0;i<20;i++){await Promise.resolve();while(tasks.length)tasks.shift()();}};
 await flush();
 assert(get('#t-account').innerHTML.includes('Display name (optional, for registration)'));
 get('#account-form').elements.displayName.value='  Samantha  ';
 await get('#account-form').onsubmit({preventDefault(){},submitter:{dataset:{mode:'signup'}}});
 assert.equal(signupPayload.options.data.display_name,'Samantha');
 assert.equal(signupPayload.options.emailRedirectTo,'http://localhost:8000/dbd-toolkit.html');
 get('#account-form').elements.displayName.value='';
 await get('#account-form').onsubmit({preventDefault(){},submitter:{dataset:{mode:'signup'}}});
 assert.equal(Object.keys(signupPayload.options.data).length,0);
 get('#account-form').elements.displayName.value='x'.repeat(41);signupPayload=null;
 await get('#account-form').onsubmit({preventDefault(){},submitter:{dataset:{mode:'signup'}}});
 assert.equal(signupPayload,null);
 get('#account-form').elements.displayName.value='';
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
 assert.equal(run('matches.length'),0,'Guest logs must not be silently uploaded');
 assert(get('#t-account').innerHTML.includes('&lt;Samantha&gt;'));
 assert(!get('#t-account').innerHTML.includes('<Samantha>')); 
 assert.equal(get('#account-prompt').hidden,true,'Hide registration prompt for signed-in users');
 assert.equal(run('observedBuilds.length'),0,'Guest builds must not be silently uploaded');
 context.observed={...observed,id:11,player:'Account A observed'};await run('FogAccounts.saveObserved(observed)');
 assert(observedRows.has('account-a:11'));assert(!rows.has('account-a:11'));
 assert(!stored.get('fog.observedBuilds').includes('Account A observed'));
 context.record=record(2,'account A');await run('FogAccounts.saveMatch(record)');assert.equal(rows.get('account-a:2').data.notes,'account A');
 assert(!stored.get('fog.matches').includes('account A'),'Cloud rows must not enter guest storage');
 failWrites=true;context.record=record(3,'offline');await assert.rejects(run('FogAccounts.saveMatch(record)'),/Offline/);assert.equal(run('matches.length'),1);failWrites=false;
 current={id:'account-b',email:'b@example.com',email_confirmed_at:'2026-10-20'};listener('SIGNED_IN',{user:current});await flush();assert.equal(run('matches.length'),0);
 assert.equal(run('observedBuilds.length'),0,'Account B must not see account A observed builds');
 context.observed={...observed,id:12};await run('FogAccounts.saveObserved(observed)');await run('FogAccounts.deleteObserved(12)');assert(!observedRows.has('account-b:12'));assert(observedRows.has('account-a:11'));
 context.record=record(4,'account B');await run('FogAccounts.saveMatch(record)');await run('FogAccounts.deleteMatch(4)');assert(!rows.has('account-b:4'));assert(rows.has('account-a:2'));
 current=null;listener('SIGNED_OUT',null);await flush();assert.equal(get('#account-prompt').hidden,false,'Restore registration prompt after sign-out');assert.equal(run('matches[0].notes'),'guest');assert.equal(run('observedBuilds[0].id'),10);
 missingObserved=true;current={id:'account-a',email:'a@example.com',email_confirmed_at:'2026-10-20'};listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('matches.length'),1,'Missing observed migration must not break own match history');
 await assert.rejects(run('FogAccounts.saveObserved(observed)'),/unavailable/);
 missingObserved=false;
 current={id:'unverified',email:'c@example.com',email_confirmed_at:null};listener('SIGNED_IN',{user:current});await flush();
 assert.equal(run('matches.length'),0);await assert.rejects(run('FogAccounts.saveMatch(record)'),/wait/);
 assert(get('#t-account').innerHTML.includes('verify your email'));
 console.log('PASS: library search and role counts; account/observed-build isolation; missing-migration fallback; guest preservation; offline write failure; deletion ownership; unverified-user write blocking. Live database RLS and email delivery still require project setup.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
