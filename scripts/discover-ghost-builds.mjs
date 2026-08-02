/**
 * Discover all ghost builds on Base44 CDN since Omega 3.
 * Ghost = stale bundle NOT in live index → App dependency tree.
 * Device blocklist also includes historical WKWebView cache (CDN may be 404).
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ASSET_HOST,
  HISTORICAL_DEVICE_CACHED_GHOSTS,
  HOSTED,
  STALE_APP,
  buildDeviceGhostBlocklist,
  extractAssetRefs,
  fetchText,
  resolveLiveActiveAssets,
} from './ghost-builds-registry.mjs';

const GIT_FROM = process.env.GHOST_GIT_FROM ?? 'omega-3';
const GIT_TO = process.env.GHOST_GIT_TO ?? 'HEAD';
const CONCURRENCY = 12;

function gitChunkNames(pattern) {
  try {
    const raw = execSync(
      `git log ${GIT_FROM}..${GIT_TO} --all -p -- scripts/ docs/ index.html src/ 2>/dev/null | grep -oE '${pattern}' || true`,
      { encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 },
    );
    return [...new Set(raw.match(new RegExp(pattern, 'g')) ?? [])];
  } catch {
    return [];
  }
}

async function headOk(url) {
  const res = await fetch(url, { method: 'HEAD', headers: { 'cache-control': 'no-cache' } });
  return res.ok;
}

async function mapPool(items, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length || 1) }, worker));
  return out;
}

export async function discoverGhostBuilds({ writeGhostFile = true } = {}) {
  const { liveIndex, liveApp, active: activeList } = await resolveLiveActiveAssets();
  const active = new Set(activeList);

  const appCandidates = gitChunkNames('App-[A-Za-z0-9_-]+\\.js');
  const indexCandidates = gitChunkNames('index-[A-Za-z0-9_-]+\\.js');

  for (const f of [STALE_APP, liveApp, liveIndex, ...HISTORICAL_DEVICE_CACHED_GHOSTS]) {
    if (f) {
      if (f.startsWith('App-')) appCandidates.push(f);
      else indexCandidates.push(f);
    }
  }

  const uniqueApps = [...new Set(appCandidates)].sort();
  const uniqueIndices = [...new Set(indexCandidates)].sort();

  const probe = async (file) => {
    const onCdn = await headOk(`${ASSET_HOST}${file}`);
    const inLiveTree = active.has(file);
    return {
      file,
      onCdn,
      active: inLiveTree,
      isGhost: !inLiveTree && (onCdn || HISTORICAL_DEVICE_CACHED_GHOSTS.includes(file)),
    };
  };

  const appResults = await mapPool(uniqueApps, probe);
  const indexResults = await mapPool(uniqueIndices, probe);

  let ghosts = [...appResults, ...indexResults].filter((r) => r.isGhost);

  const chains = [];
  for (const { file } of indexResults.filter((r) => r.isGhost && r.onCdn)) {
    const js = await fetchText(`${ASSET_HOST}${file}`);
    const apps = [...new Set([...(js?.matchAll(/assets\/(App-[^"]+\.js)/g) ?? [])].map((m) => m[1]))];
    const shared = [...new Set([...(js?.matchAll(/assets\/(index-[^"]+\.js)/g) ?? [])].map((m) => m[1]))];
    chains.push({ index: file, apps, shared });
    for (const app of apps) {
      if (!active.has(app) && !ghosts.some((g) => g.file === app)) {
        ghosts.push({ file: app, onCdn: true, active: false, isGhost: true, linkedFrom: file });
      }
    }
    for (const idx of shared) {
      if (active.has(idx) || ghosts.some((g) => g.file === idx)) continue;
      const onCdn = await headOk(`${ASSET_HOST}${idx}`);
      if (onCdn && !active.has(idx)) {
        ghosts.push({ file: idx, onCdn: true, active: false, isGhost: true, linkedFrom: file });
      }
    }
  }

  ghosts = [...new Map(ghosts.map((g) => [g.file, g])).values()].sort((a, b) => a.file.localeCompare(b.file));

  const deviceBlocklist = buildDeviceGhostBlocklist({ ghosts, active: activeList });
  const falsePositive = deviceBlocklist.filter((f) => active.has(f));

  const onCdnCount = [...appResults, ...indexResults].filter((r) => r.onCdn).length;
  const goneCount = [...appResults, ...indexResults].filter((r) => !r.onCdn).length;
  const cdnGhosts = ghosts.filter((g) => g.onCdn);

  return {
    gitRange: `${GIT_FROM}..${GIT_TO}`,
    live: { index: liveIndex, app: liveApp },
    active: activeList,
    deviceBlocklist,
    falsePositiveInBlocklist: falsePositive,
    stats: {
      appCandidates: uniqueApps.length,
      indexCandidates: uniqueIndices.length,
      liveDeps: activeList.length,
      onCdn: onCdnCount,
      gone404: goneCount,
      cdnGhosts: cdnGhosts.length,
      deviceBlocklist: deviceBlocklist.length,
      ghosts: deviceBlocklist.length,
    },
    chains,
    ghosts,
    cdnGhosts,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  console.log('Discovering ghost builds (git archaeology + CDN probe)...\n');
  const report = await discoverGhostBuilds();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' GHOST BUILD DISCOVERY — Omega 3 → now');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Git range:       ${report.gitRange}`);
  console.log(`Live entry:      ${report.live.index} → ${report.live.app}`);
  console.log(`Live deps:       ${report.stats.liveDeps} assets in active bundle tree`);
  console.log(`CDN probe:       ${report.stats.onCdn} still HTTP 200 · ${report.stats.gone404} gone (404)`);
  console.log(`CDN ghosts:      ${report.stats.cdnGhosts} stale files still on CDN`);
  console.log(`Device blocklist: ${report.stats.deviceBlocklist} (CDN ghosts + WKWebView cache history)\n`);

  if (report.falsePositiveInBlocklist.length) {
    console.log('ERROR: blocklist would block LIVE dependency chunks:');
    for (const f of report.falsePositiveInBlocklist) console.log(`  ✗ ${f} — LIVE BUNDLE USES THIS`);
    console.log('');
  }

  if (report.chains.length) {
    console.log('Ghost index → App chains:');
    for (const { index, apps, shared } of report.chains) {
      const sharedNote = shared?.length ? ` + shared: ${shared.join(', ')}` : '';
      console.log(`  ${index} → ${apps.join(', ') || '(no App)'}${sharedNote}`);
    }
    console.log('');
  }

  console.log('Device blocklist (WKWebView cache purge + JS blocker):');
  for (const file of report.deviceBlocklist) {
    const onCdn = report.ghosts.find((g) => g.file === file)?.onCdn;
    const tag = onCdn ? 'CDN' : 'cache';
    console.log(`  ✗ ${file} (${tag})`);
  }

  const outDir = resolve('reports');
  mkdirSync(outDir, { recursive: true });
  const reportPath = resolve(outDir, 'ghost-builds-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const blockPath = resolve('ios/App/App/ghost-builds.txt');
  if (writeGhostFile) {
    mkdirSync(dirname(blockPath), { recursive: true });
    const lines = [
      '# Auto-generated by npm run ghosts:discover — do not edit by hand',
      `# Live entry: ${report.live.index} → ${report.live.app}`,
      '# Lines starting with + are LIVE CDN deps — never block on device',
      ...report.active.map((f) => `+ ${f}`),
      '# Stale WKWebView / CDN cache — block and purge',
      ...report.deviceBlocklist,
    ];
    writeFileSync(blockPath, `${lines.join('\n')}\n`);
    console.log(`Wrote ${blockPath} (${report.deviceBlocklist.length} blockers)`);
    console.log('==> Merging bundled ios/public ALLOW entries...');
    execSync('node scripts/sync-ghost-builds-native.mjs', { stdio: 'inherit' });
  } else {
    console.log('(Skipped ghost-builds.txt write — caller will run ghosts:sync)');
  }

  console.log(`\nWrote ${reportPath}`);
  console.log(`
CDN DELETE: not possible from terminal — Base44 keeps hashed files forever.
DEVICE FIX: npm run ghosts:eliminate → Delete app → Restart iPhone → Xcode Clean → Run
BYPASS CDN: npm run apply:v87-from-omega3 (bundled — no Base44 ghosts)
`);

  process.exit(report.falsePositiveInBlocklist.length ? 2 : 0);
}
