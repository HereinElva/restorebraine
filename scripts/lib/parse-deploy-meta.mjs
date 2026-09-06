/**
 * Parse restorebraine deploy / fingerprint meta from HTML.
 * Handles Base44 reformatted tags (content before name, v295-abc123 suffix).
 */

/** @param {string} html @param {string} name */
export function metaContent(html, name) {
  const tag =
    html.match(new RegExp(`<meta[^>]*name="${name}"[^>]*>`, 'i'))?.[0] ??
    html.match(new RegExp(`<meta[^>]*content="[^"]*"[^>]*name="${name}"[^>]*>`, 'i'))?.[0];
  if (!tag) return null;
  return tag.match(/content="([^"]+)"/i)?.[1] ?? null;
}

/** Deploy build number from restorebraine-deploy (v295 or v295-202a780). */
export function parseDeployFromHtml(html) {
  const raw = metaContent(html, 'restorebraine-deploy');
  if (!raw) {
    const tag = html.match(/<meta[^>]*restorebraine-deploy[^>]*>/i)?.[0];
    const fallback = tag?.match(/content="([^"]+)"/i)?.[1];
    if (!fallback) return '?';
    const m = fallback.match(/^v?(\d+)/);
    return m?.[1] ?? '?';
  }
  const m = raw.match(/^v?(\d+)/);
  return m?.[1] ?? '?';
}

/** Optional commit suffix embedded in deploy meta (v295-202a780 → 202a780). */
export function parseDeployCommitSuffix(html) {
  const raw = metaContent(html, 'restorebraine-deploy');
  if (!raw) return null;
  const m = raw.match(/^v?\d+-([0-9a-f]{7,40})$/i);
  return m?.[1] ?? null;
}

/** Source commit from dedicated meta tags. */
export function parseSourceCommitFromHtml(html) {
  return (
    metaContent(html, 'restorebraine-source-commit') ??
    metaContent(html, 'restorebraine-source-fingerprint') ??
    parseDeployCommitSuffix(html)
  );
}

export function parseBuildIdFromHtml(html) {
  return metaContent(html, 'restorebraine-build-id');
}
