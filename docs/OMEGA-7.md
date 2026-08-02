# Omega 7 — bundled iOS archive (v107)

Known-good Restorebraine **bundled** build — login, gallery, organize folder counts, ghost-safe.

| Item | Value |
|------|--------|
| **Git tag** | `omega-7` |
| **Archive label** | **Omega 7** |
| **Build** | v107 |
| **Pinned bundle** | `index-tYDTTZJZ.js` → `App-CirTR_fE.js` |
| **Pin file** | `ios/App/App/OMEGA-7-PIN.txt` |

## Restore Omega 7 (byte-exact — use this)

```bash
cd ~/restorebraine
npm run restore:omega-7
```

Or:

```bash
git fetch origin --tags
git reset --hard omega-7
npm install
npm run ghosts:sync
npm run verify:omega-7
npm run verify:login-organize
```

Then: **Delete app → Restart iPhone → Xcode Clean Build Folder → Run or Archive**

Label the Xcode archive: **Omega 7**

Green bar:

`BUNDLED · kbrown native v107 · Omega 7 · index-tYDTTZJZ.js`

## Verify before Archive

```bash
npm run verify:omega-7
npm run verify:login-organize
```

Both must pass. `verify:bundled-v87` is **legacy** — ignore its FAILED on v107.

## NEVER run on Omega 7 (breaks archive / ghosts)

| Command | Why |
|---------|-----|
| `npm run fix:no-change` | Switches to **hosted** CDN |
| `npm run apply:v87-from-omega3` | Rebuilds + ports omega-3 over frozen files |
| `npm run port:omega3-gallery` | Overwrites gallery/login stack |
| `npm run ghosts:scan` / `discover` / `eliminate` without sync | Used to strip bundled ALLOW (now auto-syncs — still avoid) |
| `npm run build` | Wrong bundled index (login-redirect.js) |

## SAFE commands

- `npm run restore:omega-7` — reset to tag, ghost sync, verify
- `npm run verify:omega-7` — archive integrity gate
- `npm run ghosts:sync` — refresh CDN blocklist **and** keep bundled ALLOW
- `npm run verify:login-organize` — login + organize regression

## Rebuild from source (NOT byte-exact archive)

Only if you intentionally need new source changes:

```bash
npm run restore:omega-7 -- --rebuild
```

This produces a **new** `index-*.js` hash — not the pinned archive bundle.

## What Omega 7 includes

1. Bundled Mac UI (`capacitor://` ios/public)
2. Login — SignInScreen, OAuth, email, white-screen hardening
3. Organize — 8-folder model, empty-folder prune, UI count = Done alert
4. Ghost protection — bundled entry in ALLOW list; stale WKWebView blocklisted
