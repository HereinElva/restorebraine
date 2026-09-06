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
Target after publish: a NEW hash (not index-mlcqt5ef.js) + deploy v${deployBuild}

Run "node scripts/list-base44-publish-files.mjs" for the full paste list.

Critical auth files (paste into Base44 Code editor, then Publish):
  - src/App.jsx                    (unified login card — logo + Continue with Google)
  - src/components/LoginLogo.jsx
  - src/lib/login-logo-data.js     (embedded logo — run npm run build:web first)
  - src/lib/AuthContext.jsx
  - src/lib/auth-urls.js           (direct Google OAuth, not app.base44.com/login page)
  - src/api/base44Client.js

White screen fix:
  - src/components/gallery/MobileGallery.jsx  (no build-info import)
  - src/deploy-marker.js
  - src/main.jsx

After Publish: hard refresh Safari or use Private tab, then check Sign In URL.

iOS App Store / TestFlight (hosted — same as Omega):
  bash scripts/mac-start-fresh.sh
  Then Xcode Clean → Run → Archive
  Do NOT use npm run build:native-local for App Store uploads
`);
