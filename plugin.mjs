import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rename, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { startBridge } from './bridge.mjs?revision=1';

export const name = 'codex-local-message-bridge';
export const inject = ['sessionController'];

export async function apply(ctx, config) {
  if (!process.env.DSH_HOME || !config?.sessionId) throw new Error('DSH_HOME and target sessionId are required');
  await ctx.effect(async () => {
    // DSH-owned profile data, never checked into the project or printed in logs.
    const directory = join(process.env.DSH_HOME, 'profiles', 'local-message-bridge');
    const statePath = join(directory, 'connection.json');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const token = randomBytes(32).toString('hex');
    // Refuse to start for an absent session; no implicit session creation.
    await ctx.sessionController.inspect(config.sessionId, AbortSignal.timeout(10000));
    const bridge = await startBridge({ sessionId: config.sessionId, token,
      prompt: (request, signal) => ctx.sessionController.prompt(request, signal),
      inspect: (sessionId, signal) => ctx.sessionController.inspect(sessionId, signal) });
    try {
      const state = { url: bridge.url, token, sessionId: config.sessionId, pid: process.pid, version: 1 };
      await writeFile(statePath + '.tmp', JSON.stringify(state), { mode: 0o600 });
      await rename(statePath + '.tmp', statePath);
    } catch (error) { await bridge.close(); throw error; }
    ctx.logger.info('Local message bridge ready for the configured session (authenticated loopback only)');
    return async () => {
      await bridge.close();
      try {
        const saved = JSON.parse(await readFile(statePath, 'utf8'));
        if (saved.token === token) await unlink(statePath);
      } catch (error) { if (error.code !== 'ENOENT') ctx.logger.warn('Could not remove old bridge discovery file'); }
    };
  }, 'codex-local-message-bridge');
}
