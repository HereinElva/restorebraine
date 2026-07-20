/**
 * Discover all ghost builds on Base44 CDN since Omega 3.
 * Ghost = HTTP 200 on CDN but not in live index → App entrypoint chain.
 */
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOSTED, STALE_APP } from './ghost-builds-registry.mjs';

const ASSET_HOST = `${HOSTED}/assets/`;
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

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
  if (!res.ok) return null;
  return res.text();
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

export async function discoverGhostBuilds() {
  const liveHtml = await fetchText(HOSTED);
  const liveIndex = liveHtml?.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? null;
  const liveIndexJs = liveIndex ? await fetchText(`${ASSET_HOST}${liveIndex}`) : null;
  const liveApp = liveIndexJs?.match(/assets\/(App-[^"]+\.js)/)?.[1] ?? null;

  const active = new Set([liveIndex, liveApp].filter(Boolean));

  const appCandidates = gitChunkNames('App-[A-Za-z0-9_-]+\\.js');
  const indexCandidates = gitChunkNames('index-[A-Za-z0-9_-]+\\.js');

  // Always probe known stale + live (live App may not appear in git yet)
  for (const f of [STALE_APP, liveApp, liveIndex, 'App-BMryy2H5.js', 'index-CLtZjYMv.js', 'index-CJJVGreG.js', 'index-Dzn3_rKv.js']) {
    if (f) {
      if (f.startsWith('App-')) appCandidates.push(f);
      else indexCandidates.push(f);
    }
  }

  const uniqueApps = [...new Set(appCandidates)].sort();
  const uniqueIndices = [...new Set(indexCandidates)].sort();

  const probe = async (file) => {
    const onCdn = await headOk(`${ASSET_HOST}${file}`);
    return {
      file,
      onCdn,
      active: active.has(file),
      isGhost: onCdn && !active.has(file),
    };
  };

  const appResults = await mapPool(uniqueApps, probe);
  const indexResults = await mapPool(uniqueIndices, probe);

  let ghosts = [...appResults, ...indexResults].filter((r) => r.isGhost);

  // Expand ghost index chains → linked App + shared index chunks
  const chains = [];
  const toProbe = new Set();
  for (const { file } of indexResults.filter((r) => r.isGhost)) {
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
      if (!active.has(idx)) toProbe.add(idx);
    }
  }

  // Second pass: shared index chunks imported by ghost indices (e.g. index-Dzn3_rKv.js)
  for (const file of [...toProbe]) {
    if (ghosts.some((g) => g.file === file)) continue;
    const onCdn = await headOk(`${ASSET_HOST}${file}`);
    if (onCdn && !active.has(file)) {
      ghosts.push({ file, onCdn: true, active: false, isGhost: true, linkedFrom: 'ghost-chain' });
    }
  }

  ghosts = [...new Map(ghosts.map((g) => [g.file, g])).values()].sort((a, b) => a.file.localeCompare(b.file));

  const onCdnCount = [...appResults, ...indexResults].filter((r) => r.onCdn).length;
  const goneCount = [...appResults, ...indexResults].filter((r) => !r.onCdn).length;

  return {
    gitRange: `${GIT_FROM}..${GIT_TO}`,
    live: { index: liveIndex, app: liveApp },
    active: [...active],
    stats: {
      appCandidates: uniqueApps.length,
      indexCandidates: uniqueIndices.length,
      onCdn: onCdnCount,
      gone404: goneCount,
      ghosts: ghosts.length,
    },
    chains,
    ghosts,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  console.log('Discovering ghost builds (git archaeology + CDN probe)...\n');
  const report = await discoverGhostBuilds();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' GHOST BUILD DISCOVERY — Omega 3 → now');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Git range:     ${report.gitRange}`);
  console.log(`Live entry:    ${report.live.index} → ${report.live.app}`);
  console.log(`Candidates:    ${report.stats.appCandidates} App + ${report.stats.indexCandidates} index (from git/scripts)`);
  console.log(`CDN probe:     ${report.stats.onCdn} still HTTP 200 · ${report.stats.gone404} gone (404)`);
  console.log(`GHOSTS FOUND:  ${report.stats.ghosts}\n`);

  if (report.chains.length) {
    console.log('Ghost index → App chains (these block cached phones):');
    for (const { index, apps, shared } of report.chains) {
      const sharedNote = shared?.length ? ` + shared: ${shared.join(', ')}` : '';
      console.log(`  ${index} → ${apps.join(', ') || '(no App)'}${sharedNote}`);
    }
    console.log('');
  }

  console.log('Full ghost blocklist (block on device + purge WKWebView cache):');
  for (const g of report.ghosts) {
    const note = g.linkedFrom ? `(via ${g.linkedFrom})` : '';
    console.log(`  ✗ ${g.file} ${note}`);
  }

  const outDir = resolve('reports');
  mkdirSync(outDir, { recursive: true });
  const reportPath = resolve(outDir, 'ghost-builds-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const blockPath = resolve('ios/App/App/ghost-builds.txt');
  mkdirSync(dirname(blockPath), { recursive: true });
  const lines = [
    '# Auto-generated by npm run ghosts:discover — do not edit by hand',
    `# Live: ${report.live.index} → ${report.live.app}`,
    ...report.ghosts.map((g) => g.file),
  ];
  writeFileSync(blockPath, `${lines.join('\n')}\n`);

  console.log(`\nWrote ${reportPath}`);
  console.log(`Wrote ${blockPath} (${report.ghosts.length} ghosts)`);
  console.log(`
CDN DELETE: not possible from terminal — Base44 keeps hashed files forever.
DEVICE FIX: rebuild iOS app (BUILD_STAMP change purges cache) + ghost URL blocker.
TERMINAL:   npm run ghosts:eliminate
`);

  process.exit(report.ghosts.length ? 1 : 0);
}
