/**
 * Bakes BUILD_STAMP into dist/index.html, injects v4 login shell + v4-native-boot.js.
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

const v4LoginShell = `
      <div id="rb-v4-login-shell" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eff6ff,#f5f3ff,#fdf2f8);padding:max(16px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left));box-sizing:border-box;font-family:system-ui,sans-serif;">
        <div style="background:#fff;border-radius:24px;padding:36px 28px;box-shadow:0 10px 40px rgba(0,0,0,0.1);max-width:360px;width:100%;text-align:center;">
          <img src="./login-logo.png" alt="Restorebraine" width="56" height="56" style="width:56px;height:56px;border-radius:16px;object-fit:cover;display:block;margin:0 auto 12px;box-shadow:0 6px 20px rgba(96,165,250,0.22);" />
          <h1 style="font-size:24px;font-weight:700;color:#111;margin:0 0 28px;">Restorebraine</h1>
          <button type="button" id="rb-v4-google-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#60a5fa,#a78bfa);color:#fff;border:none;border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;touch-action:manipulation;">Continue with Google</button>
        </div>
      </div>`;

let html = readFileSync(distIndex, 'utf8');
html = html.replace(/<meta name="restorebraine-build-stamp"[^>]*>/, '');
html = html.replace(
  /<meta name="restorebraine-deploy"/,
  `<meta name="restorebraine-build-stamp" content="${stamp.replace(/"/g, '')}" />\n    <meta name="restorebraine-deploy"`,
);

// Replace pre-React spinner with v4 login card (visible before React mounts).
html = html.replace(
  /<div id="root">[\s\S]*?<\/div>\s*(?=\n\s*<script>\s*\n\(function\(\)\{)/,
  `<div id="root">${v4LoginShell}\n    </div>\n`,
);

if (!html.includes('v4-native-boot.js')) {
  html = html.replace('</body>', '    <script src="./v4-native-boot.js"></script>\n  </body>');
}

writeFileSync(distIndex, html);
console.log(`OK: stamped dist/index.html with v4 login shell (v${buildNum})`);

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
