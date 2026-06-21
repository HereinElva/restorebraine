/**
 * Bakes BUILD_STAMP into dist/index.html, injects v4 sign-in shell + v4-native-boot.js.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distIndex = resolve('dist/index.html');
const distBridge = resolve('dist/restorebraine-v4-bridge.js');
const stampPath = resolve('ios/App/App/BUILD_STAMP.txt');
const buildInfoPath = resolve('src/lib/build-info.js');

if (!existsSync(distIndex)) {
  console.error('FAIL: dist/index.html missing');
  process.exit(1);
}

const stamp = existsSync(stampPath)
  ? readFileSync(stampPath, 'utf8').trim()
  : 'unknown';
const buildNum = readFileSync(buildInfoPath, 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1] ?? '?';

const v4SignInShell = `
      <main id="restorebraine-signin-shell" class="rb-signin-shell" data-rb-v4-auth="preboot" aria-label="Sign in to Restorebraine">
        <div class="rb-signin-card">
          <h1 class="rb-signin-title">Restorebraine</h1>
          <p class="rb-signin-build-tag" id="rb-signin-build-tag">Bundled app · loading…</p>
          <button type="button" id="restorebraine-google-btn" class="rb-signin-google">Continue with Google</button>
        </div>
      </main>`;

let html = readFileSync(distIndex, 'utf8');
html = html.replace(/<meta name="restorebraine-build-stamp"[^>]*>/, '');
html = html.replace(
  /<meta name="restorebraine-deploy"/,
  `<meta name="restorebraine-build-stamp" content="${stamp.replace(/"/g, '')}" />\n    <meta name="restorebraine-deploy"`,
);

if (!html.includes('signin-preboot.css')) {
  html = html.replace('</head>', '    <link rel="stylesheet" href="./signin-preboot.css" />\n  </head>');
}

html = html.replace(
  /<div id="root">[\s\S]*?<\/div>\s*(?=\n\s*<script>\s*\n\(function\(\)\{)/,
  `<div id="root">${v4SignInShell}\n    </div>\n`,
);

if (!html.includes('v4-native-boot.js')) {
  html = html.replace('</body>', '    <script src="./v4-native-boot.js"></script>\n  </body>');
}

writeFileSync(distIndex, html);
console.log(`OK: stamped dist/index.html with v4 sign-in shell (v${buildNum})`);

if (html.includes('restorebraine-v4-bridge.js')) {
  console.error('FAIL: index.html must not include sync restorebraine-v4-bridge.js — use main.jsx async load');
  process.exit(1);
}

if (existsSync(distBridge)) {
  let bridge = readFileSync(distBridge, 'utf8');
  bridge = bridge.replace(/BUILD_LABEL_PLACEHOLDER/g, stamp.replace(/'/g, "\\'"));
  writeFileSync(distBridge, bridge);
  console.log(`OK: stamped dist/restorebraine-v4-bridge.js (v${buildNum})`);
}
