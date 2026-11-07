import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import {startBridge} from './bridge.mjs';
const exec=promisify(execFile),client=fileURLToPath(new URL('./client.mjs',import.meta.url));
test('CLI finds current discovery in a fresh path and sends one fixed-session request',async t=>{
 const home=await mkdtemp(join(tmpdir(),'dsh-cli 含空格 '));t.after(()=>rm(home,{recursive:true,force:true}));
 const sent=[];const bridge=await startBridge({sessionId:'session-cli-fixture',token:'a'.repeat(64),prompt:async r=>{sent.push(r);return {accepted:true};},inspect:async()=>({events:[]})});
 t.after(()=>bridge.close());const dir=join(home,'profiles/local-message-bridge');await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'connection.json'),JSON.stringify({url:bridge.url,token:'a'.repeat(64)}));
 const run=(...args)=>exec(process.execPath,[client,...args],{env:{...process.env,DSH_HOME:home}});
 assert.equal(JSON.parse((await run('status')).stdout).sessionId,'session-cli-fixture');
 const message=join(home,'message.txt');await writeFile(message,'synthetic request');
 assert.equal(JSON.parse((await run('send',message,'fixture-request-01')).stdout).accepted,true);
 assert.equal(sent.length,1);assert.equal(sent[0].sessionId,'session-cli-fixture');
 assert.equal(JSON.parse((await run('read')).stdout).cursor,-1);
 await assert.rejects(run('send',join(home,'missing.txt'),'fixture-request-02'));
});
test('CLI rejects remote discovery without making a request',async t=>{
 const home=await mkdtemp(join(tmpdir(),'dsh-remote-'));t.after(()=>rm(home,{recursive:true,force:true}));
 const dir=join(home,'profiles/local-message-bridge');await mkdir(dir,{recursive:true});
 await writeFile(join(dir,'connection.json'),JSON.stringify({url:'https://example.invalid',token:'synthetic'}));
 await assert.rejects(exec(process.execPath,[client,'status'],{env:{...process.env,DSH_HOME:home}}),e=>e.stderr.includes('non-local'));
});
