import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let startBridge;
try { ({ startBridge } = await import('./bridge.mjs')); } catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('authenticated fixed-session bridge and text-only history', async (t) => {
  assert.equal(typeof startBridge, 'function', 'message bridge is not implemented');
  const sent = [];
  const bridge = await startBridge({
    sessionId: 'session-test', token: 'a'.repeat(64),
    prompt: async (value) => { sent.push(value); return { accepted: true }; },
    inspect: async () => ({ events: [
      { seq: 1, type: 'user/message', time: 10, data: { content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' }, role: 'user', id: 'test-message' } },
      { seq: 2, type: 'assistant/message', time: 20, data: { message: { content: [{ type: 'reasoning', text: 'private' }, { type: 'text', text: 'reply' }, { type: 'tool-call', args: 'secret' }] } } },
      { seq: 3, type: 'turn/end', time: 30, data: { outcome: 'completed' } },
    ] }),
  });
  t.after(() => bridge.close());
  const call = (path, options = {}) => fetch(bridge.url + path, {
    ...options, headers: { authorization: 'Bearer ' + 'a'.repeat(64), ...options.headers },
  });
  const post = (body, extra = {}) => call('/prompt', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...extra } });
  assert.equal((await fetch(bridge.url + '/status')).status, 401);
  assert.equal((await call('/status', { headers: { authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await call('/status', { headers: { origin: 'https://evil.example' } })).status, 403);
  const wrongHostStatus = await new Promise((resolve, reject) => {
    http.get(bridge.url + '/status', { headers: { host: 'evil.example', authorization: 'Bearer ' + 'a'.repeat(64) } },
      (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(wrongHostStatus, 403);
  assert.equal((await call('/status')).status, 200);
  assert.equal((await post({ requestId: 'request-0001', text: '  ' })).status, 400);
  assert.equal((await post({ requestId: 'request-0001', text: 'hello', sessionId: 'other' })).status, 400);
  assert.equal((await post({ requestId: 'request-0001', text: 'hello' }, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post({ requestId: 'request-0001', text: 'x'.repeat(40000) })).status, 413);
  const request = { requestId: 'request-0001', text: '这是 Codex 的核对。' };
  assert.equal((await post(request)).status, 202);
  assert.equal((await post(request)).status, 202);
  assert.equal((await post({ ...request, text: 'different' })).status, 409);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sessionId, 'session-test');
  assert.equal(sent[0].mode, 'queue');
  assert.deepEqual(sent[0].content, [{ type: 'text', text: request.text }]);
  const fullHistory = await (await call('/messages')).json();
  assert.deepEqual(fullHistory.messages[0], { seq: 1, time: 10, role: 'user', text: 'hello' });
  const history = await (await call('/messages?after=1')).json();
  assert.equal(history.cursor, 3);
  assert.deepEqual(history.messages, [{ seq: 2, time: 20, role: 'assistant', text: 'reply' }]);
  assert.equal(JSON.stringify(history).includes('private'), false);
  assert.equal(JSON.stringify(history).includes('secret'), false);
  assert.equal((await call('/messages?after=no')).status, 400);
  assert.equal((await call('/unknown')).status, 404);
  assert.equal((await post({ requestId: 'request-0002', text: '2' })).status, 202);
  assert.equal((await post({ requestId: 'request-0003', text: '3' })).status, 202);
  assert.equal((await post({ requestId: 'request-0004', text: '4' })).status, 202);
  assert.equal((await post({ requestId: 'request-0005', text: '5' })).status, 429);
});

test('upstream error does not leak details or claim acceptance', async (t) => {
  assert.equal(typeof startBridge, 'function');
  const bridge = await startBridge({ sessionId: 'session-test', token: 'b'.repeat(64),
    prompt: async () => { throw Object.assign(new Error('private upstream detail'), { status: 403 }); }, inspect: async () => ({ events: [] }) });
  t.after(() => bridge.close());
  const response = await fetch(bridge.url + '/prompt', { method: 'POST',
    headers: { authorization: 'Bearer ' + 'b'.repeat(64), 'content-type': 'application/json' },
    body: JSON.stringify({ requestId: 'request-fail', text: 'hello' }) });
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('private'), false);
});
