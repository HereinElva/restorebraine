/**
 * Frozen Omega 7 archive definition — do not change without cutting a new omega tag.
 * Used by verify-omega-7-archive.mjs and restore-omega-7.sh.
 */
export const OMEGA_7_TAG = 'omega-7';

export const OMEGA_7 = {
  tag: OMEGA_7_TAG,
  archive: 'Omega 7',
  buildNumber: 107,
  mode: 'bundled',
  /** Committed bundled entry on the omega-7 tag (byte-exact archive). */
  pinnedEntry: 'index-tYDTTZJZ.js',
  pinnedApp: 'App-CirTR_fE.js',
};

/** Commands that flip mode or strip bundled ghost allow — never run on Omega 7 restore. */
export const OMEGA_7_FORBIDDEN = [
  'npm run fix:no-change',
  'npm run ghosts:scan',
  'npm run ghosts:discover',
  'npm run ghosts:eliminate',
  'npm run apply:v87-from-omega3',
  'npm run port:omega3-gallery',
  'npm run build',
  'npm run cap:hosted',
];

/** Safe restore / verify only. */
export const OMEGA_7_SAFE = [
  'npm run restore:omega-7',
  'npm run verify:omega-7',
  'npm run verify:login-organize',
  'npm run ghosts:sync',
  'npm run prove:phone',
];
