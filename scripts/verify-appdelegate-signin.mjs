#!/usr/bin/env node
/** Verify AppDelegate has Sign In Browser fallback (commit 36cbafa+). */
import { readFileSync, existsSync } from 'node:fs';

const path = 'ios/App/App/AppDelegate.swift';
if (!existsSync(path)) {
  console.error('✗ Missing AppDelegate.swift');
  process.exit(1);
}

const src = readFileSync(path, 'utf8');
const hasBrowserFallback = src.includes('getBrowserPlugin') && src.includes('launchOAuthInBrowser');
const hasSignInIntercept = /isSignInButton\s*=\s*\^sign in\$/i.test(src.replace(/\s+/g, ' '))
  || src.includes("isSignInButton = /^sign in$/i.test(label)");

if (hasBrowserFallback && hasSignInIntercept) {
  console.log('OK: AppDelegate has Sign In fix (Browser fallback + Sign In intercept)');
  process.exit(0);
}

console.error('✗ AppDelegate missing Sign In fix — git reset --hard origin/cursor/apple-privacy-plist-bacf');
console.error('  You need commit 36cbafa+ then Xcode Clean → Run');
if (!hasBrowserFallback) console.error('  Missing: getBrowserPlugin / launchOAuthInBrowser');
if (!hasSignInIntercept) console.error('  Missing: isSignInButton intercept');
process.exit(1);
