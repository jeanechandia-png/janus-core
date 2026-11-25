import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyIssuedSession } from '../apps/pwa/founder-session.js';
const session = { token:'janus_auth_'+'a'.repeat(43), principal:{id:'founder',role:'founder_director'} };
test('fresh browser session is verified against the active Core before storage', async () => {
  let count=0;
  const request=async (path,options)=>{
    count++;
    assert.equal(path,'/api/auth/session');
    assert.equal(options.cache,'no-store');
    assert.equal(options.headers.authorization,'Bearer '+session.token);
    return new Response(JSON.stringify({ok:true,principal:session.principal}),{status:200});
  };
  assert.equal(await verifyIssuedSession(session,'founder',request),session);
  await assert.rejects(verifyIssuedSession({...session,token:'undefined'},'founder',request));
  assert.equal(count,1);
});
test('expired or wrong-role sessions do not become browser sessions', async () => {
  await assert.rejects(verifyIssuedSession(session,'founder',async()=>new Response('{}',{status:401})));
  await assert.rejects(verifyIssuedSession(session,'founder',async()=>new Response(JSON.stringify({ok:true,principal:{id:'founder',role:'operator'}}),{status:200})));
});
