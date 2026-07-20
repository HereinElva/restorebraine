/**
 * Shared checks for the five post-v87 failure patterns.
 * Used by gate-five-patterns.mjs, align-all.sh, and gate-pre-update.mjs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export const PATTERNS = [
  {
    id: 1,
    name: 'Three layers, one updated',
    symptom: 'GitHub + Xcode reset but live Base44 JS stayed stale',
    fix: 'Run npm run align:all — all three layers must pass before iPhone test',
  },
  {
    id: 2,
    name: 'Partial Publish',
    symptom: 'OAuth index-*.js updated but App-*.js from older build (mixed chunks)',
    fix: 'Base44 Publish ALL 43 files once — npm run base44:nuke-list',
  },
  {
    id: 3,
    name: 'OAuth-only diagnostics masked UI',
    symptom: 'diagnose:oauth passes while gallery/CSS chunks are stale',
    fix: 'Always run npm run diagnose:chunks after any Base44 Publish',
  },
  {
    id: 4,
    name: 'Hosted vs bundled flip-flop',
    symptom: 'build:native-local or appStartPath breaks hosted OAuth',
    fix: 'Stay hosted — npm run cap:hosted; never npm run build:native-local',
  },
  {
    id: 5,
    name: 'Login rewrites stacked on UI changes',
    symptom: 'NativeLoginCard/SignInScreen experiments broke session bridge',
    fix: 'Keep v87 SignedOutLanding only — npm run verify:lingering --strict',
  },
];

export function runNode(script, args = []) {
  const r = spawnSync('node', [script, ...args], { encoding: 'utf8', stdio: 'pipe' });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

export function checkHostedMode() {
  try {
    const cap = JSON.parse(readFileSync('ios/App/App/capacitor.config.json', 'utf8'));
    const root = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
    const hosted =
      cap.server?.url?.includes('restorebraine.base44.app')
      && root.server?.url?.includes('restorebraine.base44.app')
      && !cap.server?.appStartPath
      && !root.server?.appStartPath;
    return { ok: hosted, detail: hosted ? 'hosted mode locked' : 'bundled mode detected' };
  } catch {
    return { ok: false, detail: 'capacitor.config.json missing or invalid' };
  }
}

export function checkNoLoginRewrites() {
  const forbidden = [
    'src/components/auth/NativeLoginCard.jsx',
    'src/components/auth/SignInScreen.jsx',
    'src/pages/LoginPage.jsx',
  ];
  const present = forbidden.filter((p) => existsSync(p));
  return {
    ok: present.length === 0,
    detail: present.length ? `forbidden files: ${present.join(', ')}` : 'v87 SignedOutLanding only',
  };
}

export function checkOAuthOrigin() {
  try {
    const guard = readFileSync('src/lib/native-platform-guard.js', 'utf8');
    const ok = guard.includes('${DEFAULT_APP_ORIGIN}${path}') && !guard.includes('${BASE44_PLATFORM_URL}${path}');
    return { ok, detail: ok ? 'DEFAULT_APP_ORIGIN OAuth' : 'wrong OAuth host in guard' };
  } catch {
    return { ok: false, detail: 'native-platform-guard.js missing' };
  }
}

export function checkThreeLayers() {
  const sync = runNode('scripts/diagnose-sync-depth.mjs');
  const chunks = runNode('scripts/diagnose-chunk-pair.mjs');
  const ok = sync.ok && chunks.ok;
  let detail = 'GitHub ↔ Base44 ↔ Capacitor aligned';
  if (!sync.ok) detail = 'layer mismatch — see diagnose:sync';
  else if (!chunks.ok) detail = 'Base44 chunks not synced with git — partial Publish';
  return { ok, detail };
}

export function checkChunkPair() {
  const chunks = runNode('scripts/diagnose-chunk-pair.mjs');
  return { ok: chunks.ok, detail: chunks.ok ? 'index + App chunks paired' : 'mixed publish or Publish pending' };
}

export function checkLingering() {
  const ling = runNode('scripts/verify-no-post-v87-lingering.mjs', ['--strict']);
  return { ok: ling.ok, detail: ling.ok ? 'no post-v87 artifacts' : 'post-v87 patterns found' };
}

export function checkLiveOAuth() {
  const oauth = runNode('scripts/prove-live-oauth.mjs');
  return { ok: oauth.ok, detail: oauth.ok ? 'live OAuth on restorebraine.base44.app' : 'live OAuth broken or unknown' };
}

/** Map each pattern id → { ok, detail } */
export function evaluateAllPatterns() {
  const hosted = checkHostedMode();
  const login = checkNoLoginRewrites();
  const oauthGit = checkOAuthOrigin();
  const layers = checkThreeLayers();
  const chunks = checkChunkPair();
  const lingering = checkLingering();
  const liveOAuth = checkLiveOAuth();

  return {
    1: layers,
    2: chunks,
    3: { ok: chunks.ok && liveOAuth.ok, detail: chunks.ok ? 'chunks + OAuth both checked' : 'UI may be stale despite OAuth pass' },
    4: hosted,
    5: { ok: lingering.ok && login.ok && oauthGit.ok, detail: lingering.ok ? login.detail : lingering.detail },
    _liveOAuth: liveOAuth,
    _hosted: hosted,
  };
}
