import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {apply} from './plugin.mjs';

test('plugin starts for an existing session, publishes discovery, and removes only its own state',async t=>{
 const home=await mkdtemp(join(tmpdir(),'dsh plugin 测试 '));const old=process.env.DSH_HOME;process.env.DSH_HOME=home;
 let dispose;const inspected=[],sent=[];
 const ctx={logger:{info(){},warn(){}},effect:async fn=>{dispose=await fn();},
 sessionController:{inspect:async id=>{inspected.push(id);return {events:[]};},prompt:async p=>{sent.push(p);return {accepted:true};}}};
 t.after(async()=>{await dispose?.();if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(home,{recursive:true,force:true});});
 await apply(ctx,{sessionId:'session-fixture'});
 assert.deepEqual(inspected,['session-fixture']);
 const file=join(home,'profiles/local-message-bridge/connection.json');
 const state=JSON.parse(await readFile(file,'utf8'));
 assert.match(state.token,/^[a-f0-9]{64}$/);assert.match(state.url,/^http:\/\/127\.0\.0\.1:\d+$/);
 const response=await fetch(state.url+'/status',{headers:{authorization:'Bearer '+state.token}});
 assert.equal(response.status,200);assert.equal((await response.json()).sessionId,'session-fixture');assert.equal(sent.length,0);
 await dispose();dispose=null;await assert.rejects(access(file));
});
test('plugin cleanup preserves a replacement instance discovery file',async t=>{
 const home=await mkdtemp(join(tmpdir(),'dsh-owned-'));const old=process.env.DSH_HOME;process.env.DSH_HOME=home;let dispose;
 t.after(async()=>{await dispose?.();if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(home,{recursive:true,force:true});});
 await apply({logger:{info(){},warn(){}},effect:async fn=>{dispose=await fn();},
 sessionController:{inspect:async()=>({events:[]}),prompt:async()=>({accepted:true})}},{sessionId:'session-fixture'});
 const file=join(home,'profiles/local-message-bridge/connection.json');
 const replacement={token:'replacement-fixture-token'};await writeFile(file,JSON.stringify(replacement));
 await dispose();dispose=null;assert.deepEqual(JSON.parse(await readFile(file,'utf8')),replacement);
});
test('plugin refuses an absent target without publishing discovery',async t=>{
 const home=await mkdtemp(join(tmpdir(),'dsh-absent-'));const old=process.env.DSH_HOME;process.env.DSH_HOME=home;
 t.after(async()=>{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(home,{recursive:true,force:true});});
 await assert.rejects(apply({effect:async fn=>fn(),sessionController:{inspect:async()=>{throw Error('absent');}}},{sessionId:'session-missing'}),/absent/);
 await assert.rejects(access(join(home,'profiles/local-message-bridge/connection.json')));
});
