#!/usr/bin/env node
/** Blocks v87 Sign In regression: OAuth must use restorebraine.base44.app, not app.base44.com. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const errors = [];
const guard = readFileSync(resolve('src/lib/native-platform-guard.js'), 'utf8');
const delegate = readFileSync(resolve('ios/App/App/AppDelegate.swift'), 'utf8');
const build = readFileSync(resolve('src/lib/build-info.js'), 'utf8').match(/BUILD_NUMBER = (\d+)/)?.[1];

if (build !== '87') errors.push(`BUILD_NUMBER must be 87 (got ${build ?? '?'})`);
if (guard.includes('${BASE44_PLATFORM_URL}${path}')) {
  errors.push('native-platform-guard must not build OAuth URLs on app.base44.com (404)');
}
if (!guard.includes('${DEFAULT_APP_ORIGIN}${path}')) {
  errors.push('native-platform-guard must use DEFAULT_APP_ORIGIN for /api/apps/auth/*');
}
if (/PLATFORM \+ path/.test(delegate)) {
  errors.push('AppDelegate getCanonicalOAuthUrl must not use PLATFORM + path');
}
if (!delegate.includes('RESTOREBRAINE + path')) {
  errors.push('AppDelegate getCanonicalOAuthUrl must use RESTOREBRAINE + path');
}

if (errors.length) {
  console.error('\nOAuth URL verify FAILED:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}

console.log('OK: v87 OAuth URLs use restorebraine.base44.app/api/apps/auth/*');
