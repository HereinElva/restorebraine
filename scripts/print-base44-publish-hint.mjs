import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const deployBuild =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';

let liveBundle = 'unknown';
try {
  const html = execSync('curl -sL https://restorebraine.base44.app', { encoding: 'utf8', timeout: 15000 });
  liveBundle = html.match(/assets\/(index-[^"]+\.js)/)?.[1] ?? 'not found';
} catch {
  liveBundle = 'could not fetch';
}

console.log(`
Base44 does NOT auto-update from GitHub. You must paste files in the Code editor and click Publish.

Live bundle right now: ${liveBundle}
Target after publish: a NEW hash (not index-DVkubWP5.js) + deploy v${deployBuild}

Run "node scripts/list-base44-publish-files.mjs" for the full paste list.

Critical auth files (Base44 support said these were never published):
  - src/lib/AuthContext.jsx   (uses base44.auth.redirectToLogin on web)
  - src/lib/app-params.js     (no iPhone deep-link block)
  - src/lib/auth-urls.js      (app.base44.com/login, not base44.app/login)
  - src/api/base44Client.js

White screen fix:
  - src/components/gallery/MobileGallery.jsx  (no build-info import)
  - src/deploy-marker.js
  - src/main.jsx

After Publish: hard refresh Safari or use Private tab, then check Sign In URL.

iOS without Base44: npm run build:native-local → Xcode Run (do NOT run cap:hosted)
`);
