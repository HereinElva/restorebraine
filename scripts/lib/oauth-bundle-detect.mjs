/**
 * Detect OAuth host used by minified Vite bundles (live Base44 + ios/public).
 * Minifier renames DEFAULT_APP_ORIGIN → de, fe, dt, etc. between builds.
 */
const HOSTED = 'https://restorebraine.base44.app';
const BROKEN = 'https://app.base44.com';

export function extractOAuthHost(js) {
  if (!js) return { host: '?', pattern: 'missing', fixed: false, broken: false };

  // Legacy broken (pre-f1b2505 live bundle index-CLtZjYMv.js)
  if (/\$\{dt\}\$\{e\}/.test(js)) {
    return { host: 'app.base44.com', pattern: 'broken template ${dt}${e}', fixed: false, broken: true };
  }
  if (/\$\{it\}\$\{e\}/.test(js) && js.includes('app.base44.com')) {
    return { host: 'app.base44.com', pattern: 'broken template ${it}${e}', fixed: false, broken: true };
  }

  // Minified getCanonicalOAuthUrl: return`${de}${e}?${n.toString()}`
  const tmpl = js.match(/return`\$\{([a-z$][a-z0-9$]*)\}\$\{([a-z$][a-z0-9$]*)\}\?\$\{/i);
  if (tmpl) {
    const originVar = tmpl[1];
    const assign = js.match(new RegExp(`${originVar.replace(/\$/g, '\\$')}="(https://[^"]+)"`));
    if (assign) {
      const host = new URL(assign[1]).hostname;
      const fixed = host === 'restorebraine.base44.app';
      const broken = host === 'app.base44.com';
      return {
        host,
        pattern: `${fixed ? 'fixed' : broken ? 'broken' : 'unclear'} minified \${${originVar}} → ${assign[1]}`,
        fixed,
        broken,
      };
    }
  }

  if (js.includes('fe="https://restorebraine.base44.app"')) {
    return { host: 'restorebraine.base44.app', pattern: 'fixed (fe=DEFAULT_APP_ORIGIN)', fixed: true, broken: false };
  }

  if (/="https:\/\/restorebraine\.base44\.app"/.test(js) && /\/api\/apps\/auth/.test(js)) {
    return { host: 'restorebraine.base44.app', pattern: 'fixed (restorebraine origin + auth path)', fixed: true, broken: false };
  }

  const literal = js.match(/https:\/\/([a-z0-9.-]+)\/api\/apps\/auth\/login/);
  if (literal) {
    const fixed = literal[1] === 'restorebraine.base44.app';
    const broken = literal[1] === 'app.base44.com';
    return { host: literal[1], pattern: 'literal in bundle', fixed, broken };
  }

  return { host: 'unknown', pattern: 'unclear', fixed: false, broken: false };
}

export function analyzeOAuthInJs(js, label = '') {
  const r = extractOAuthHost(js);
  return {
    label,
    brokenTemplate: r.broken,
    brokenPlatformAuth: r.host === 'app.base44.com' && r.broken,
    fixedOrigin: r.fixed,
    usesDefaultOrigin: r.fixed,
    bytes: js?.length ?? 0,
    host: r.host,
    pattern: r.pattern,
  };
}

export { HOSTED, BROKEN };
