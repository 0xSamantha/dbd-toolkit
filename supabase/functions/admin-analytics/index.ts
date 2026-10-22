import {importPKCS8,SignJWT} from 'npm:jose@5.9.6';
import {createHandler} from './handler.mjs';

const PROPERTY='560294101';
let oauth:{token:string,expires:number}|null=null;
async function googleToken(){
  if(oauth&&oauth.expires>Date.now())return oauth.token;
  const account=JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')||'{}');
  if(typeof account.client_email!=='string'||typeof account.private_key!=='string')throw Error('Missing service account');
  const key=await importPKCS8(account.private_key,'RS256');
  const assertion=await new SignJWT({scope:'https://www.googleapis.com/auth/analytics.readonly'})
    .setProtectedHeader({alg:'RS256'}).setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('1h').sign(key);
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),
    signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error('Google authentication failed');
  const result=await response.json();
  if(!result.access_token)throw Error('Missing Google token');
  oauth={token:result.access_token,expires:Date.now()+(Number(result.expires_in||3600)-120)*1000};
  return oauth.token;
}
async function report(days:number){
  const accessToken=await googleToken();
  // Complete calendar days in the GA property's reporting timezone; today is excluded.
  const dateRanges=[{startDate:days+'daysAgo',endDate:'yesterday'}];
  const metrics=['totalUsers','screenPageViews','sessions'].map(name=>({name}));
  const response=await fetch('https://analyticsdata.googleapis.com/v1beta/properties/'+PROPERTY+':batchRunReports',{
    method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    body:JSON.stringify({requests:[
      {dateRanges,metrics},
      {dateRanges,dimensions:[{name:'country'},{name:'region'}],metrics:[{name:'totalUsers'}],orderBys:[{metric:{metricName:'totalUsers'},desc:true}],limit:'30'},
      {dateRanges,dimensions:[{name:'date'}],metrics,orderBys:[{dimension:{dimensionName:'date'}}],limit:'90'}
    ]}),signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error('Google reporting failed');
  const body=await response.json();
  if(!Array.isArray(body.reports)||body.reports.length!==3)throw Error('Invalid report');
  const [totals,locations,daily]=body.reports;
  const values=(row:any)=>metrics.map((_,i)=>Number(row?.metricValues?.[i]?.value||0));
  const [visitors,views,sessions]=values(totals.rows?.[0]);
  return {propertyId:PROPERTY,days,generatedAt:new Date().toISOString(),timezone:totals.metadata?.timeZone||'Property timezone',
    totals:{visitors,views,sessions},
    locations:(locations.rows||[]).map((row:any)=>({country:row.dimensionValues[0].value,region:row.dimensionValues[1].value,visitors:Number(row.metricValues[0].value)})),
    daily:(daily.rows||[]).map((row:any)=>{const [visitors,views,sessions]=values(row);return {date:row.dimensionValues[0].value,visitors,views,sessions}}),
    thresholded:body.reports.some((r:any)=>r.metadata?.subjectToThresholding===true)};
}
Deno.serve(createHandler({
  origin:Deno.env.get('ADMIN_SITE_ORIGIN')||'https://dbdtoolkit.xyz',
  verifyUser:async(token:string)=>{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
    if(!url||!key)throw Error('Missing Supabase configuration');
    const response=await fetch(url+'/auth/v1/user',{headers:{Authorization:'Bearer '+token,apikey:key},signal:AbortSignal.timeout(15000)});
    return response.ok?await response.json():null;
  },
  report
}));
