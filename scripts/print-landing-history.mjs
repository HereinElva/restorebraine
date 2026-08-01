#!/usr/bin/env node
/**
 * Which signed-out landing the repo uses — and what changed when apply ran.
 */
console.log(`
═══════════════════════════════════════════════════════════════
 SIGNED-OUT LANDING HISTORY (what changed when)
═══════════════════════════════════════════════════════════════

THREE login screens in git history:

1) ClassicLoginLanding (pre-v87, 5762b16^)
   Centered card: Restorebraine + "Sign in to access your memories" + Sign In
   NO provider buttons

2) SignedOutLanding (v87 commit 5762b16) — WRONG for Omega 3 users
   "Find Your Memories" INSIDE gallery shell (header + bottom tabs)
   Single Sign In button

3) SignInScreen + NativeLoginCard (Omega 3 tag) — CURRENT TARGET
   Full-screen card, NO gallery tabs:
   • Continue With Google / Apple / Microsoft
   • Email + password sign in / sign up
   • Gradient "Restorebraine" title

WHAT apply:v87-from-omega3 ACTUALLY CHANGED
   audit:v87-improvements — READ-ONLY (never changes landing)
   port-omega3-gallery — Gallery.jsx only, NOT login shell
   mode flip — hosted CDN vs bundled ios/public

REBUILD AFTER PULL
   npm run apply:v87-from-omega3 -- --skip-sync
   Delete app → Restart iPhone → Xcode Clean → Run

EXPECTED ON PHONE (SignInScreen):
   Continue With Google / Apple / Microsoft buttons
   Email + password fields
   NO bottom Search/Upload/Account tabs
   NO "Find Your Memories" headline on login
═══════════════════════════════════════════════════════════════
`);
