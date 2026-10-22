/* Supabase handles password hashing, sessions and verification email delivery.
 * Database ownership/verified-email access is enforced by supabase-schema.sql.
 */
const FogAccounts=(()=>{
  let client=null,user=null,loading=false,busy=false,epoch=0,message='';
  let observedReady=false,observedError='';
  const config=window.FOG_AUTH_CONFIG||{};
  const configured=!!(config.url&&config.publishableKey&&config.redirectUrl);
  const notice=text=>{message=text;drawAccount()};
  function validateMatch(m){
    if(!m||!Number.isSafeInteger(m.id)||m.id<1||!['S','K'].includes(m.role)||
      typeof m.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||
      typeof m.character!=='string'||m.character.length>80||
      ['map','opposingKiller'].some(key=>m[key]!==undefined&&(typeof m[key]!=='string'||m[key].length>80))||
      !isValidMatchResult(m.role,m.result)||
      !Array.isArray(m.perks)||m.perks.length>4||m.perks.some(p=>typeof p!=='string'||p.length>120)||
      typeof m.notes!=='string'||m.notes.length>300)throw Error('Invalid match record. Check its date, role, result, perks and notes.');
    return {id:m.id,date:m.date,role:m.role,character:m.character,result:m.result,perks:[...m.perks],notes:m.notes,...(m.map!==undefined?{map:m.map}:{}),...(m.opposingKiller!==undefined?{opposingKiller:m.opposingKiller}:{})};
  }
  function modeNote(){
    if(loading)return 'Loading your private cloud matches…';
    return user?'Signed in: these matches are private to your account and saved online.':'Guest mode: matches are saved only in this browser. Sign in on the Account tab to use private cloud logs.';
  }
  function requireReady(){if(loading||busy)throw Error('Please wait for the current account operation to finish.');}
  async function loadMatches(token,owner){
    const all=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await client.from('matches').select('data').eq('user_id',owner).order('id',{ascending:false}).range(offset,offset+499);
      if(error)throw error;
      all.push(...data.map(row=>validateMatch(row.data)));
      if(data.length<500)break;
    }
    if(token===epoch){matches=all;loading=false;drawTrack();drawAccount();}
  }
  function refreshObserved(){if(typeof drawObserved==='function')drawObserved()}
  function observedMode(){
    if(loading)return 'Account data is loading…';
    if(user&&!observedReady)return observedError||'Your private build log is loading…';
    return user?'Private observed builds saved to your account.':'Guest mode: observed builds are stored separately in this browser.';
  }
  async function loadObserved(token,owner){
    try{
      const all=[];
      for(let offset=0;;offset+=500){
        const {data,error}=await client.from('observed_builds').select('data').eq('user_id',owner).order('id',{ascending:false}).range(offset,offset+499);
        if(error)throw error;
        all.push(...data.map(row=>validateObserved(row.data)));if(data.length<500)break;
      }
      if(token===epoch){observedBuilds=all;observedReady=true;observedError='';refreshObserved()}
    }catch(error){if(token===epoch){observedReady=false;observedError='Cloud build log unavailable: '+error.message+'. The new observed-builds database setup may still be needed.';refreshObserved()}}
  }
  function requireObserved(){requireReady();if(user&&!observedReady)throw Error(observedError||'Please wait for your cloud build log.');}
  async function saveObserved(record){
    requireObserved();const rec=validateObserved(record),token=epoch,owner=user?.id;
    if(owner){const {error}=await client.from('observed_builds').upsert({user_id:owner,id:rec.id,data:rec},{onConflict:'user_id,id'});if(error)throw error;}
    if(token!==epoch)throw Error('Your account changed before the build could be displayed.');
    observedBuilds=[rec,...observedBuilds.filter(b=>b.id!==rec.id)];
    if(!owner)store.set('fog.observedBuilds',observedBuilds);
  }
  async function deleteObserved(id){
    requireObserved();const token=epoch,owner=user?.id;
    if(owner){const {error}=await client.from('observed_builds').delete().eq('user_id',owner).eq('id',id);if(error)throw error;}
    if(token!==epoch)return;
    observedBuilds=observedBuilds.filter(b=>b.id!==id);if(!owner)store.set('fog.observedBuilds',observedBuilds);
  }
  async function importObserved(records){
    requireObserved();if(!Array.isArray(records)||records.length>5000)throw Error('Import up to 5,000 observed builds.');
    const clean=[...new Map(records.map(validateObserved).map(b=>[b.id,b])).values()],owner=user?.id,token=epoch;
    if(owner){
      if(clean.length){const {error}=await client.from('observed_builds').upsert(clean.map(data=>({user_id:owner,id:data.id,data})),{onConflict:'user_id,id'});if(error)throw error;}
      await loadObserved(token,owner);
    }else{observedBuilds=[...new Map([...observedBuilds,...clean].map(b=>[b.id,b])).values()];store.set('fog.observedBuilds',observedBuilds);}
  }
  async function copyGuestObserved(){if(!user)throw Error('Sign in first to copy your guest build log.');await importObserved(store.get('fog.observedBuilds',[]));}
  async function changeSession(session){
    const token=++epoch;matchPerkDraft={role:tr,enabled:false,perks:[],source:''};user=null;matches=[];observedBuilds=[];observedEditing=null;observedReady=false;observedError='';loading=true;drawTrack();drawAccount();refreshObserved();
    try{
      if(!session){matches=store.get('fog.matches',[]);observedBuilds=store.get('fog.observedBuilds',[]);loading=false;drawTrack();drawAccount();refreshObserved();return;}
      const {data,error}=await client.auth.getUser();if(error)throw error;
      if(token!==epoch)return;
      if(!data.user?.email_confirmed_at)throw Error('Please verify your email using the link in your inbox, then sign in.');
      user=data.user;await loadMatches(token,user.id);if(token===epoch)await loadObserved(token,user.id);
    }catch(error){if(token===epoch){user=null;matches=[];loading=true;notice('Could not load your account: '+error.message+' Sign out to return to guest mode.');drawTrack();}}
  }
  async function saveMatch(record){
    requireReady();const rec=validateMatch(record),owner=user?.id,token=epoch;
    if(owner){const {error}=await client.from('matches').upsert({user_id:owner,id:rec.id,data:rec},{onConflict:'user_id,id'});if(error)throw error;}
    if(token!==epoch)throw Error('Account changed. Reopen your account before saving again.');
    matches=[rec,...matches.filter(m=>m.id!==rec.id)];
    if(!owner)store.set('fog.matches',matches);
  }
  async function deleteMatch(id){
    requireReady();const owner=user?.id,token=epoch;
    if(owner){const {error}=await client.from('matches').delete().eq('user_id',owner).eq('id',id);if(error)throw error;}
    if(token!==epoch)return;
    matches=matches.filter(m=>m.id!==id);if(!owner)store.set('fog.matches',matches);
  }
  async function importMatches(records){
    requireReady();if(!Array.isArray(records)||records.length>5000)throw Error('Import a JSON array containing up to 5,000 matches.');
    const cleaned=[...new Map(records.map(validateMatch).map(m=>[m.id,m])).values()],owner=user?.id,token=epoch;
    if(owner){
      // One transaction for the whole import; never erase the current cloud history.
      const rows=cleaned.map(data=>({user_id:owner,id:data.id,data}));
      if(rows.length){const {error}=await client.from('matches').upsert(rows,{onConflict:'user_id,id'});if(error)throw error;}
      await loadMatches(token,owner);
    }else{matches=[...new Map([...matches,...cleaned].map(m=>[m.id,m])).values()].sort((a,b)=>b.id-a.id);store.set('fog.matches',matches);}
  }
  function isAdmin(){return !!user?.email_confirmed_at&&user.id==='16a1ddb9-7ebe-4281-a3f7-494c4da72166'&&!loading;}
  async function analytics(days){
    requireReady();if(!isAdmin())throw Error('Admin access required.');
    const {data,error}=await client.functions.invoke('admin-analytics',{body:{days}});
    if(error){
      let detail;try{detail=(await error.context.json()).error}catch{}
      throw Error(detail||'Analytics is unavailable. Deploy admin-analytics and follow ADMIN-SETUP.md.');
    }
    if(data?.error)throw Error(data.error);
    return data;
  }
  function drawAccount(){
    if(window.FogAdmin)window.FogAdmin.sync();
    if(typeof drawPresetManager==='function')drawPresetManager();
    const prompt=$('#account-prompt');if(prompt)prompt.hidden=!!user||loading;
    const node=$('#t-account');if(!node)return;
    const online=!!client;
    const displayName=typeof user?.user_metadata?.display_name==='string'?user.user_metadata.display_name.trim().slice(0,40):'';
    node.innerHTML=`<div class="card"><h2>Account</h2><p class="sub">Create an account to keep your match history private and available on your other devices.</p>
    <p role="status" aria-live="polite">${esc(message)}</p>
    ${!configured?'<p>Online accounts are not connected yet. The planner, perk library and guest match log are available.</p>':!online?'<p>Account service is loading or unavailable. Guest features still work.</p>':user?`<p>Signed in as <b>${esc(displayName||user.email)}</b>. Email verified.${displayName?`<br><small>${esc(user.email)}</small>`:""}</p><div class="row"><button class="btn" data-account="signout">Sign out</button><button class="btn ghost" data-account="upload" ${loading||busy?'disabled':''}>Copy this browser’s guest matches into my account</button></div><p class="sub">Copying keeps the guest backup in this browser and merges records by match ID. Other users cannot see your cloud history.</p>`:`<form id="account-form"><label>Display name (optional, for registration)<input name="displayName" type="text" autocomplete="nickname" maxlength="40" placeholder="What should we call you?"></label><label>Email<input name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label><p class="sub">Display names can be up to 40 characters and are optional. Sign in using your email. Use at least 12 characters when registering. Open the verification link in your email before signing in.</p><div class="row"><button class="btn" type="submit" data-mode="signin" ${busy?'disabled':''}>Sign in</button><button class="btn ghost" type="submit" data-mode="signup" ${busy?'disabled':''}>Register</button><button class="btn ghost" type="button" data-account="resend" ${busy?'disabled':''}>Resend verification email</button></div></form>${loading?'<button class="btn ghost" data-account="signout">Sign out / return to guest mode</button>':''}`}</div>`;
    const form=$('#account-form');
    if(form)form.onsubmit=async e=>{
      e.preventDefault();if(busy)return;
      const email=form.elements.email.value.trim(),password=form.elements.password.value,mode=e.submitter?.dataset.mode||'signin';
      const signupName=(form.elements.displayName?.value||'').trim();
      busy=true;notice('Please wait…');
      try{
        if(mode==='signup'){
          if(password.length<12)throw Error('Use at least 12 characters for your password.');
          if(signupName.length>40)throw Error('Use no more than 40 characters for your display name.');
          const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:config.redirectUrl,data:signupName?{display_name:signupName}:{}}});if(error)throw error;
          notice('If registration is available for this address, check your inbox for a verification link. After verifying, sign in.');
        }else{
          const {error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
          notice('Signed in. Loading your private matches…');
        }
      }catch(error){notice(error.message);}finally{busy=false;drawAccount();}
    };
    node.onclick=async e=>{
      const action=e.target.closest('[data-account]')?.dataset.account;if(!action||busy)return;
      const email=form?.elements.email.value.trim();
      try{
        if(action==='signout'){const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;message='Signed out.';await changeSession(null);}
        if(action==='upload'){await importMatches(store.get('fog.matches',[]));notice('Guest matches copied into your account. The local backup was kept.');}
        if(action==='resend'){
          if(!email||!form.elements.email.checkValidity())throw Error('Enter your email address first.');
          busy=true;const {error}=await client.auth.resend({type:'signup',email,options:{emailRedirectTo:config.redirectUrl}});if(error)throw error;
          notice('If confirmation is pending for this address, a verification link has been sent.');
        }
      }catch(error){notice(error.message);}finally{busy=false;drawAccount();}
    };
  }
  async function init(){
    drawAccount();if(!configured)return;
    try{
      if(!/^https:\/\//.test(config.url)||!/^https?:\/\//.test(config.redirectUrl))throw Error('Account service URL or confirmation redirect is invalid.');
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/dist/umd/supabase.js';script.onload=resolve;script.onerror=()=>reject(Error('Could not load the account service.'));document.head.appendChild(script);
      });
      client=window.supabase.createClient(config.url,config.publishableKey,{auth:{flowType:'implicit',detectSessionInUrl:true,persistSession:true}});
      // Do not await SDK calls inside the auth listener (avoids auth-lock deadlocks).
      client.auth.onAuthStateChange((event,session)=>{if(['INITIAL_SESSION','SIGNED_IN','SIGNED_OUT'].includes(event))setTimeout(()=>changeSession(session),0);});
      drawAccount();
    }catch(error){notice(error.message);}
  }
  return {isAdmin,analytics,presetStorageKey:()=>user?'fog.presets.'+user.id:'fog.presets.guest',canManagePresets:()=>!loading&&!busy,init,drawAccount,modeNote,saveMatch,deleteMatch,importMatches,validateMatch,observedMode,saveObserved,deleteObserved,importObserved,copyGuestObserved};
})();
FogAccounts.init();
