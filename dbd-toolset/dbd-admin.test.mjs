import assert from 'node:assert/strict';
import {createHandler,OWNER_ID} from '../supabase/functions/admin-analytics/handler.mjs';
let user=null,calls=0,verifications=0;
const handler=createHandler({
  verifyUser:async()=>{verifications++;return user},
  report:async days=>{calls++;return {days,totals:{visitors:8}}}
});
const req=(token='session',days=30,origin='https://dbdtoolkit.xyz')=>new Request('https://test/functions/v1/admin-analytics',{
  method:'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({days})
});
assert.equal((await handler(req(''))).status,401);
user={id:'other',email_confirmed_at:'2026-10-22',user_metadata:{role:'admin'}};
assert.equal((await handler(req())).status,403,'User-editable metadata must never grant admin');
user={id:OWNER_ID,email_confirmed_at:null};
assert.equal((await handler(req())).status,403);
user={id:OWNER_ID,email_confirmed_at:'2026-10-22'};
assert.equal((await handler(req('session',5))).status,400);
assert.equal((await handler(req('session',30,'https://evil.example'))).status,403);
assert.equal(calls,0);
assert.equal((await handler(req())).status,200);
assert.equal((await handler(req())).status,200);
assert.equal(calls,1,'Reports should be cached');
user={id:'other',email_confirmed_at:'yes'};
assert.equal((await handler(req())).status,403,'Cached reports must remain protected');
assert.equal(calls,1);assert(verifications>=6);
const broken=createHandler({verifyUser:async()=>({id:OWNER_ID,email_confirmed_at:'yes'}),report:async()=>{throw Error('PRIVATE_KEY_SHOULD_NOT_LEAK')}});
const error=await broken(req());assert.equal(error.status,502);assert(!(await error.text()).includes('PRIVATE_KEY_SHOULD_NOT_LEAK'));
console.log('PASS: missing session; normal user; forged metadata; unverified owner; origin; range; owner; authenticated cache; sanitized upstream error.');
