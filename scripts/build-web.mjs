// Builds the installable web app. Usage: node scripts/build-web.mjs [basePath]
//   node scripts/build-web.mjs              -> for a site at the domain root (Netlify, Cloudflare)
//   node scripts/build-web.mjs /creekfinder -> for GitHub Pages project sites
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
const env = { ...process.env, EXPO_PUBLIC_UNLOCK_ALL: process.env.EXPO_PUBLIC_UNLOCK_ALL ?? '1', EXPO_NO_TELEMETRY: '1' };
if (base) env.EXPO_BASE_URL = base;
execSync('npx expo export --platform web --output-dir dist', { stdio: 'inherit', env });

for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) {
  const p = join('dist', f);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('%BASE%', base));
}
copyFileSync('dist/index.html', 'dist/404.html'); // single-page-app fallback for GitHub Pages
console.log(`Built dist/ with base "${base || '/'}"`);
