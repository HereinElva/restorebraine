/**
 * Registry of known ghost/stale Base44 CDN assets.
 * Run `npm run ghosts:discover` to refresh from git archaeology + live CDN probe.
 */
export const HOSTED = 'https://restorebraine.base44.app';

/** Primary stale App chunk from partial Publish (gallery/CSS frozen). */
export const STALE_APP = 'App-B4VcOATW.js';

/**
 * Ghost builds confirmed on CDN (2026-07-20 full scan omega-3..HEAD).
 * Live entry: index-BtNzh8Fh.js → App-DvoqTTOC.js
 * 571+ historical index hashes return 404 — only these 5 still block cached phones.
 */
export const KNOWN_GHOST_ASSETS = [
  { file: 'App-B4VcOATW.js', note: 'Stale gallery/CSS — partial Publish (primary blocker)' },
  { file: 'App-BMryy2H5.js', note: 'Ghost App from index-CLtZjYMv.js' },
  { file: 'index-CLtZjYMv.js', note: 'Pre-v87 OAuth-only index → App-BMryy2H5.js' },
  { file: 'index-CJJVGreG.js', note: 'Alternate stale index → App-B4VcOATW.js' },
  { file: 'index-Dzn3_rKv.js', note: 'Shared chunk in ghost index-CLtZjYMv chain (not in live index)' },
];

export const GHOST_INDEX_FILES = KNOWN_GHOST_ASSETS
  .map((g) => g.file)
  .filter((f) => f.startsWith('index-'));

export const GHOST_APP_FILES = KNOWN_GHOST_ASSETS
  .map((g) => g.file)
  .filter((f) => f.startsWith('App-'));

export function allGhostFilenames() {
  return [...new Set(KNOWN_GHOST_ASSETS.map((g) => g.file))];
}

export async function fetchLiveEntrypoint() {
  const res = await fetch(HOSTED, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
  const html = await res.text();
  const indexName = html.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? null;
  if (!indexName) return { html, indexName: null, appName: null };

  const indexRes = await fetch(`${HOSTED}/assets/${indexName}`, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  const indexJs = await indexRes.text();
  const appName = indexJs.match(/assets\/(App-[^"]+\.js)/)?.[1] ?? null;
  return { html, indexName, appName };
}

export async function probeGhostAssets(extra = []) {
  const live = await fetchLiveEntrypoint();
  const active = new Set([live.indexName, live.appName].filter(Boolean));
  const candidates = [...new Set([...allGhostFilenames(), ...extra])];
  const results = [];

  for (const file of candidates) {
    if (!file) continue;
    const res = await fetch(`${HOSTED}/assets/${file}`, {
      method: 'HEAD',
      headers: { 'cache-control': 'no-cache' },
    });
    const onCdn = res.ok;
    const isGhost = onCdn && !active.has(file);
    results.push({
      file,
      onCdn,
      active: active.has(file),
      isGhost,
      status: res.status,
    });
  }

  return { live, active: [...active], results };
}
