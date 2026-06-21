/**
 * Generates BASE44-AI-PASTE-INSTRUCTIONS.md — full copy-paste prompt for Base44 AI.
 * Usage: node scripts/generate-base44-ai-paste-instructions.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const deployBuild =
  readFileSync(resolve('src/deploy-marker.js'), 'utf8').match(/DEPLOY_BUILD = (\d+)/)?.[1] ?? '?';

const publishPath = resolve(`base44-publish-v${deployBuild}.txt`);
const publish = readFileSync(publishPath, 'utf8');

const header = `# Base44 AI — Full Copy-Paste Instructions (deploy v${deployBuild})

Paste this entire document into the Base44 AI chat, OR work through each **FILE** block below in the Code editor.

## Your task

Update all **32 files** below in the Restorebraine Base44 Code editor, then click **Publish once**.

## Rules

1. For each file: open the exact path → Select All → Delete → paste the code block → Save
2. Do **NOT** click Publish until all 32 files are saved
3. \`src/lib/native-bundle-mode.js\` **must** be \`LOCAL_NATIVE_BUNDLE = false\` (hosted web — never \`true\`)
4. OAuth must use \`https://app.base44.com/api/apps/auth/login\` — never \`app.base44.com/login\`
5. Login UI is \`src/screens/SignInScreen.jsx\` — remove any inline \`LoginGate\` from \`App.jsx\`

## After Publish — verify

- View source on https://restorebraine.com → \`<meta name="restorebraine-deploy" content="v${deployBuild}">\`
- Login: white card, title **Restorebraine**, button **Continue with Google** only
- https://restorebraine.base44.app/native-oauth-return.js must return JavaScript (not HTML)
- Google sign-in completes → Gallery

---

`;

writeFileSync(resolve('BASE44-AI-PASTE-INSTRUCTIONS.md'), header + publish);
console.log(`Wrote BASE44-AI-PASTE-INSTRUCTIONS.md (${header.length + publish.length} chars)`);
