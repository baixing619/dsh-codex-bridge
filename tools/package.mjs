import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version');
const dist = join(root, 'dist');
const name = 'dsh-codex-bridge-v' + version;
const stage = join(dist, name);
const files = [
  'bridge.mjs',
  'plugin.mjs',
  'client.mjs',
  'Install.ps1',
  'README.md',
  'LICENSE',
  'skills/dsh-message-bridge/SKILL.md',
  'skills/dsh-message-bridge/scripts/client.mjs',
];
await mkdir(dist, { recursive: true });
// Refuse an existing stage so stale development files cannot enter the archive.
await mkdir(stage);
for (const file of files) {
  const target = join(stage, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, file), target);
}
const zip = join(dist, name + '.zip');
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  'Compress-Archive -LiteralPath $env:PACKAGE_STAGE -DestinationPath $env:PACKAGE_ZIP -Force'], {
  env: { ...process.env, PACKAGE_STAGE: stage, PACKAGE_ZIP: zip },
  stdio: 'inherit',
});
const bytes = await readFile(zip);
await writeFile(join(dist, 'SHA256SUMS.txt'),
  createHash('sha256').update(bytes).digest('hex') + '  ' + name + '.zip\n');
console.log(JSON.stringify({ zip, bytes: bytes.length, files: files.length }));
