#!/usr/bin/env node
/**
 * Which signed-out landing the repo uses — and what changed when apply ran.
 */
console.log(`
═══════════════════════════════════════════════════════════════
 SIGNED-OUT LANDING HISTORY (what changed when)
═══════════════════════════════════════════════════════════════

BEFORE v87 (5762b16^) — pre-apply baseline many users remember
  • Full-screen gradient background
  • Centered white card: Restorebraine logo + "Sign in to access your memories"
  • Single Sign In button
  • NO gallery header, NO bottom nav tabs, NO "Find Your Memories" headline
  • Component: ClassicLoginLanding.jsx (restored)

v87 commit 5762b16 — added SignedOutLanding (WRONG for many users)
  • "Find Your Memories" inside gallery shell (header + Search/Upload/Account tabs)
  • Disabled grey search bar + Sign In at bottom
  • Looks like gallery but you are not logged in

Omega 3 tag — SignInScreen + NativeLoginCard
  • Full-screen card with Continue with Google / Apple / Microsoft / email
  • NO gallery shell — different from both above

commit 6286112 — forced SignedOutLanding for ALL !isAuthenticated (not only auth_error)
commit 14cfaef — apply default flipped HOSTED → BUNDLED (phone loads Mac ios/public)
port-omega3-gallery — overwrites Gallery.jsx only (not login shell)

WHAT apply:v87-from-omega3 CHANGED ON LOGIN
  • audit:v87-improvements — READ-ONLY, never changes landing
  • apply — rebuilds bundled JS + ports gallery files; login = whatever App.jsx uses
  • mode flip — hosted CDN vs bundled ios/public (different layer, can look like "wrong UI")

CURRENT REPO TARGET (after this fix)
  • ClassicLoginLanding — pre-v87 centered card (before 5762b16)
  • Keep OAuth + auth boot fixes from 6709917 / 379a38c

REBUILD AFTER PULL
  npm run apply:v87-from-omega3 -- --skip-sync
  Delete app → Restart iPhone → Xcode Clean → Run

Green bar should show NEW index-*.js — NOT index-Co8ztVUU.js
═══════════════════════════════════════════════════════════════
`);
