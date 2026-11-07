import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const MAX_BODY = 32768;
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

function reply(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function bodyOf(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new HttpError(415, 'JSON required');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, 'Message too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}

export function publicHistory(events, after) {
  const messages = [];
  for (const event of events) {
    if (event.seq <= after || !['user/message', 'assistant/message'].includes(event.type)) continue;
    const content = (event.type === 'user/message' ? event.data?.content : event.data?.message?.content) ?? [];
    const text = content.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
    if (text) messages.push({ seq: event.seq, time: event.time, role: event.type.split('/')[0], text });
  }
  const lastTurn = events.findLast((event) => ['turn/start', 'turn/end'].includes(event.type));
  return { cursor: events.at(-1)?.seq ?? -1, messages: messages.slice(-40),
    truncated: messages.length > 40, turnState: lastTurn?.type ?? null };
}

/** Dedicated authenticated local endpoint; it never proxies arbitrary DSH methods. */
export async function startBridge({ sessionId, token, prompt, inspect }) {
  if (!sessionId || typeof token !== 'string' || token.length < 32) throw new Error('Bridge configuration missing');
  const expected = Buffer.from('Bearer ' + token);
  const requests = new Map(); let admitted = [];
  let authority;
  const server = http.createServer(async (req, res) => {
    try {
      if (req.socket.remoteAddress !== '127.0.0.1' || req.headers.origin || req.headers.host !== authority) throw new HttpError(403, 'Local CLI requests only');
      const supplied = Buffer.from(req.headers.authorization ?? '');
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, 'Authentication required');
      const url = new URL(req.url, 'http://' + authority);
      if (req.method === 'GET' && url.pathname === '/status') {
        return reply(res, 200, { ready: true, sessionId, pid: process.pid, version: 1 });
      }
      if (req.method === 'GET' && url.pathname === '/messages') {
        const value = url.searchParams.get('after') ?? '-1';
        if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < -1) throw new HttpError(400, 'Invalid cursor');
        const snapshot = await inspect(sessionId, AbortSignal.timeout(10000));
        return reply(res, 200, { sessionId, ...publicHistory(snapshot.events, Number(value)) });
      }
      if (req.method !== 'POST' || url.pathname !== '/prompt') throw new HttpError(404, 'Unknown operation');
      const body = await bodyOf(req);
      if (!body || Array.isArray(body) || Object.keys(body).some((key) => !['text', 'requestId'].includes(key)) ||
          typeof body.text !== 'string' || !body.text.trim() || body.text.length > 12000 ||
          typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestId)) throw new HttpError(400, 'Invalid message or requestId');
      let entry = requests.get(body.requestId);
      if (entry && entry.text !== body.text) throw new HttpError(409, 'requestId already belongs to another message');
      if (!entry) {
        const now = Date.now(); admitted = admitted.filter((time) => now - time < 60000);
        if (admitted.length >= 4) throw new HttpError(429, 'Too many messages; wait a minute');
        admitted.push(now);
        const pending = Promise.resolve().then(() => prompt({ sessionId, requestId: body.requestId,
          mode: 'queue', content: [{ type: 'text', text: body.text }], clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, AbortSignal.timeout(15000)));
        entry = { text: body.text, pending }; requests.set(body.requestId, entry);
        if (requests.size > 128) requests.delete(requests.keys().next().value);
      }
      const result = await entry.pending;
      if (result?.accepted !== true) throw new Error('Prompt not acknowledged');
      reply(res, 202, { accepted: true, sessionId, requestId: body.requestId });
    } catch (error) {
      const local = error instanceof HttpError;
      if (!res.headersSent) reply(res, local ? error.status : 502, { error: local ? error.message : 'DSH operation failed; inspect DSH status before retrying with the same requestId' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  server.on('error', () => {});
  authority = '127.0.0.1:' + server.address().port;
  return { url: 'http://' + authority, close: () => new Promise((resolve) => {
    server.close(resolve); server.closeAllConnections();
  }) };
}
