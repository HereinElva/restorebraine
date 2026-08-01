/**
 * Registry of known ghost/stale Base44 CDN assets.
 * Run `npm run ghosts:discover` to refresh from git archaeology + live CDN probe.
 */
export const HOSTED = 'https://restorebraine.base44.app';
export const ASSET_HOST = `${HOSTED}/assets/`;

/** Primary stale App chunk from partial Publish (gallery/CSS frozen). */
export const STALE_APP = 'App-B4VcOATW.js';

/**
 * Stale bundles phones may still have in WKWebView disk cache (CDN often 404 now).
 * NEVER include live dependency chunks — see resolveLiveActiveAssets().
 */
export const HISTORICAL_DEVICE_CACHED_GHOSTS = [
  'App-B4VcOATW.js',
  'App-BMryy2H5.js',
  'index-CLtZjYMv.js',
  'index-CJJVGreG.js',
  'index-BdI0OyrO.js',
  'index-C0QSqhq1.js',
  'index-CV4Cquht.js',
  'index-DU9XZ7q7.js',
  'index-gi7V8MEL.js',
  'index-jnFezVWb.js',
  'index-lILXYrc5.js',
];

/** Documented stale CDN assets (registry notes — not all may still be HTTP 200). */
export const KNOWN_GHOST_ASSETS = [
  { file: 'App-B4VcOATW.js', note: 'Stale gallery/CSS — partial Publish (primary blocker)' },
  { file: 'App-BMryy2H5.js', note: 'Ghost App from index-CLtZjYMv.js' },
  { file: 'index-CLtZjYMv.js', note: 'Pre-v87 OAuth-only index → App-BMryy2H5.js' },
  { file: 'index-CJJVGreG.js', note: 'Alternate stale index → App-B4VcOATW.js' },
];

export const GHOST_INDEX_FILES = KNOWN_GHOST_ASSETS
  .map((g) => g.file)
  .filter((f) => f.startsWith('index-'));

export const GHOST_APP_FILES = KNOWN_GHOST_ASSETS
  .map((g) => g.file)
  .filter((f) => f.startsWith('App-'));

export function extractAssetRefs(js) {
  if (!js) return [];
  return [...js.matchAll(/assets\/((?:App|index)-[^"']+\.(?:js|css))/g)].map((m) => m[1]);
}

export async function fetchText(url) {
  const res = await fetch(url, { headers: { 'cache-control': 'no-cache', pragma: 'no-cache' } });
  if (!res.ok) return null;
  return res.text();
}

/** Full live bundle tree: entry index + App + all imported shared chunks. */
export async function resolveLiveActiveAssets() {
  const liveHtml = await fetchText(HOSTED);
  const liveIndex = liveHtml?.match(/\/assets\/(index-[^"]+\.js)/)?.[1] ?? null;
  const liveIndexJs = liveIndex ? await fetchText(`${ASSET_HOST}${liveIndex}`) : null;
  const liveApp = liveIndexJs?.match(/assets\/(App-[^"]+\.js)/)?.[1] ?? null;

  const active = new Set([liveIndex, liveApp].filter(Boolean));
  const queue = [...extractAssetRefs(liveIndexJs)].filter((f) => f.endsWith('.js'));
  const seen = new Set(active);

  while (queue.length) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    active.add(file);
    if (!file.startsWith('index-')) continue;
    const js = await fetchText(`${ASSET_HOST}${file}`);
    for (const ref of extractAssetRefs(js)) {
      if (ref.endsWith('.js') && !seen.has(ref)) queue.push(ref);
    }
  }

  if (liveApp) {
    const appJs = await fetchText(`${ASSET_HOST}${liveApp}`);
    for (const ref of extractAssetRefs(appJs)) active.add(ref);
  }

  return { html: liveHtml, liveIndex, liveApp, active: [...active].sort() };
}

export function buildDeviceGhostBlocklist({ ghosts = [], active = [] } = {}) {
  const activeSet = new Set(active);
  const block = new Set();

  for (const file of HISTORICAL_DEVICE_CACHED_GHOSTS) {
    if (!activeSet.has(file)) block.add(file);
  }
  for (const g of ghosts) {
    const file = typeof g === 'string' ? g : g.file;
    if (file && !activeSet.has(file)) block.add(file);
  }

  return [...block].sort();
}

export function allGhostFilenames() {
  return buildDeviceGhostBlocklist({ ghosts: KNOWN_GHOST_ASSETS.map((g) => g.file) });
}

export async function fetchLiveEntrypoint() {
  const { html, liveIndex, liveApp } = await resolveLiveActiveAssets();
  return { html, indexName: liveIndex, appName: liveApp };
}

export async function probeGhostAssets(extra = []) {
  const { liveIndex, liveApp, active: activeList } = await resolveLiveActiveAssets();
  const active = new Set(activeList);
  const candidates = [...new Set([...HISTORICAL_DEVICE_CACHED_GHOSTS, ...allGhostFilenames(), ...extra])];
  const results = [];

  for (const file of candidates) {
    if (!file) continue;
    const res = await fetch(`${ASSET_HOST}${file}`, {
      method: 'HEAD',
      headers: { 'cache-control': 'no-cache' },
    });
    const onCdn = res.ok;
    const isGhost = !active.has(file) && (onCdn || HISTORICAL_DEVICE_CACHED_GHOSTS.includes(file));
    results.push({
      file,
      onCdn,
      active: active.has(file),
      isGhost,
      status: res.status,
    });
  }

  return { live: { index: liveIndex, app: liveApp }, active: activeList, results };
}
