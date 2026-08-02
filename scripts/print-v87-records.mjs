#!/usr/bin/env node
/** Print GitHub record of what v87 actually is (commits + canonical files). */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const stamp = readFileSync(resolve('src/lib/build-info.js'), 'utf8');
const build = stamp.match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';
const label = stamp.match(/NATIVE_BUILD_LABEL = '([^']+)'/)?.[1] ?? '?';
const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

console.log(`
═══════════════════════════════════════════════════════════════
 GITHUB v87 RECORD (what v87 actually looked like)
═══════════════════════════════════════════════════════════════

Git commits (nothing after f1b2505 on cursor/apple-privacy-plist-bacf):

  5762b16  v87 UI born
           • BUILD_NUMBER 86 → 87
           • Added SignedOutLanding.jsx ("Find Your Memories" + Sign In)
           • Removed login sheet overlay / dev clutter

  f1b2505  v87 tip (current branch target)
           • Same UI as 5762b16
           • OAuth fix: restorebraine.base44.app/api/apps/auth/* (not app.base44.com 404)
           • Only 4 files changed from 5762b16:
             native-platform-guard.js, AppDelegate.swift,
             verify-oauth-urls.mjs, print-base44-publish-hint.mjs

Your HEAD: ${head}  BUILD: v${build}  Label: ${label}

Signed-out screen (this IS v87 — not a failed reset):
  • Header: Restorebraine logo
  • "Find Your Memories" gradient title
  • Disabled search bar
  • "Sign in to upload photos..." text
  • Blue/purple "Sign In" button above tab bar
  • Search | Upload | Account tabs

Architecture (v87):
  • Native shell (Xcode) wraps WKWebView
  • UI loads from https://restorebraine.base44.app (hosted)
  • Sign In opens system Safari for Google OAuth (required — not a native form)

Pull exact v87 from GitHub:
  git fetch origin cursor/apple-privacy-plist-bacf
  git reset --hard f1b2505
  bash scripts/mac-ios-setup.sh cursor/apple-privacy-plist-bacf
  node scripts/verify-v87-baseline.mjs

Base44 must match GitHub (browser Publish — no terminal command):
  Paste from ~/restorebraine and Publish:
    src/lib/native-platform-guard.js   ← fixes Sign In (live site still has old OAuth)
    index.html                         (content="v${build}")
    src/App.jsx
    src/components/auth/SignedOutLanding.jsx

Why "no change" on phone:
  • UI already matches v87 (screenshot is correct)
  • Live Base44 JS was never Published with f1b2505 OAuth fix
  • Mac/git reset does not update hosted JavaScript on Base44

Verify after Publish:
  curl -s https://restorebraine.base44.app | grep restorebraine-deploy
  (OAuth fix confirmed when Sign In opens restorebraine.base44.app/api/apps/auth/login)
═══════════════════════════════════════════════════════════════
`);
