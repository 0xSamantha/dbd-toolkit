// Authentication is checked before reading cached reports or calling Google.
export const OWNER_ID='16a1ddb9-7ebe-4281-a3f7-494c4da72166';
export function createHandler({verifyUser,report,origin='https://dbdtoolkit.xyz'}){
  const cache=new Map();
  return async request=>{
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if(request.headers.get('origin')===origin){
      headers['Access-Control-Allow-Origin']=origin;
      headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
      headers['Access-Control-Allow-Methods']='POST, OPTIONS';
    }
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return reply({error:'Origin not allowed.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'Use POST.'},405);
    const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if(!token)return reply({error:'Sign in first.'},401);
    let user;
    try{user=await verifyUser(token)}catch{return reply({error:'Session could not be verified. Sign in again.'},401)}
    if(!user)return reply({error:'Sign in again.'},401);
    if(user.id!==OWNER_ID||!user.email_confirmed_at)return reply({error:'Admin access required.'},403);
    let days;
    try{({days}=await request.json())}catch{return reply({error:'Invalid request.'},400)}
    if(![7,30,90].includes(days))return reply({error:'Choose 7, 30 or 90 days.'},400);
    const saved=cache.get(days);
    if(saved&&Date.now()-saved.time<300000)return reply(saved.data);
    try{
      const data=await report(days);
      cache.set(days,{time:Date.now(),data});
      return reply(data);
    }catch{
      return reply({error:'Analytics is not connected or Google could not return the report. Check the service-account secret, Data API, and property Viewer access using ADMIN-SETUP.md.'},502);
    }
  };
}
