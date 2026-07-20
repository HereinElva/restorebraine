/**
 * Registry of known ghost/stale Base44 CDN assets.
 * Ghost = old hashed bundle still HTTP 200 but not referenced by live index.html.
 * Base44 CDN never deletes these — we block them on device and purge WKWebView cache.
 */
export const HOSTED = 'https://restorebraine.base44.app';

/** Primary stale App chunk from partial Publish (gallery/CSS frozen). */
export const STALE_APP = 'App-B4VcOATW.js';

/** Historical ghosts — still on CDN as of last scan. */
export const KNOWN_GHOST_ASSETS = [
  { file: 'App-B4VcOATW.js', note: 'Stale gallery/CSS — partial Publish' },
  { file: 'index-CLtZjYMv.js', note: 'Old index → App-BMryy2H5.js chain' },
  { file: 'App-BMryy2H5.js', note: 'Ghost App from index-CLtZjYMv.js' },
  { file: 'index-CLtZjYMv.js', note: 'Pre-v87 OAuth-only index publish' },
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
