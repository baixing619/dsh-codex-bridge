import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [command = 'status', argument, requestId] = process.argv.slice(2);
try {
  const home = process.env.DSH_HOME ?? (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'DSHDesktop', 'dsh-home'));
  if (!home) throw new Error('Set DSH_HOME to your DSH profile data directory');
  const state = JSON.parse(await readFile(join(home, 'profiles', 'local-message-bridge', 'connection.json'), 'utf8'));
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(state.url)) throw new Error('Refusing a non-local bridge address');
  let path, options = {};
  if (command === 'status') path = '/status';
  else if (command === 'read') path = '/messages?after=' + encodeURIComponent(argument ?? '-1');
  else if (command === 'send') {
    if (!argument || !requestId) throw new Error('Usage: send <UTF-8-message-file> <unique-request-id>; reuse the same ID after an uncertain result');
    path = '/prompt'; options = { method: 'POST', body: JSON.stringify({ text: await readFile(argument, 'utf8'), requestId }) };
  } else throw new Error('Commands: status | read [afterSeq] | send <UTF-8-message-file> <unique-request-id>');
  const response = await fetch(state.url + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { authorization: 'Bearer ' + state.token, 'content-type': 'application/json' } });
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'Bridge is not active, or the message file does not exist. Check DSH plugin status / DSH_HOME.' : error.message);
  process.exitCode = 1;
}
