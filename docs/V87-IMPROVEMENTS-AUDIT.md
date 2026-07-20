# v87 improvements audit — what this build includes

This documents every user-requested improvement **through v87**, merged with the **Omega 3 gallery reference**, while **excluding post-v87 breakdowns** and **blocking ghost CDN builds**.

## One command (Mac)

```bash
cd ~/restorebraine
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install
npm run apply:v87-from-omega3
npm run audit:v87-improvements
```

Xcode: **Delete app → Clean Build Folder → Run**

Verify bundled mode: `npm run verify:bundled-v87`

---

## Included improvements

### Omega 3 gallery (bundled reference — v261)

| Feature | Files |
|---------|--------|
| Folder persistence across restart + pull-to-refresh | `gallery-organize-snapshot.js`, `folder-membership-cache.js`, `folder-membership.js` |
| Multi-round organize (tap again for next batch) | `run-media-organize.js`, `OrganizeButton.jsx` |
| Pull-to-refresh safety (spinner always clears) | `PullToRefresh.jsx` (6s timeout) |
| Gallery prefetch + OAuth session events | `gallery-data.js`, `Gallery.jsx` |
| Full organize prompts | `media-organize.js` (Omega 3 version) |

### v87 corrections (on path from omega-3)

| Commit | Improvement |
|--------|-------------|
| `17af6de` | App Store privacy plist (5.1.1) |
| `6c15e97` | v82 compact AI consent + fast upload pipeline |
| `390928b` | v83 `native-media-input` iOS upload picker |
| `698975e` | Hosted OAuth + session persistence (bundled build strips `server.url`) |
| `5762b16` | SignedOutLanding — "Find Your Memories" + Sign In |
| `f1b2505` | OAuth on `restorebraine.base44.app` (not `app.base44.com` 404) |
| `de07029` | React-first mount, auth boot timeout (`capacitor-ready.js`) |
| `36cbafa` | Sign In Browser fallback when InAppBrowser not ready |

---

## Explicitly excluded (post-v87 breakdown causes)

These caused white screens, wrong login pages, account wipe confusion, and "no change" on iPhone:

- **15+ login rewrites** — `NativeLoginCard`, `SignInScreen`, `LoginPage`, `NativeLoginProviders`
- **v4-core bridge era** — `RestorebraineBridgeViewController`, custom native plugins
- **Bundled/hosted flip-flop in production** — `575dbaf` experiment, `LOCAL_NATIVE_BUNDLE`, `appStartPath`
- **Shell stabilizer / gesture gates** — `native-shell-stabilizer.js`
- **Stale CDN ghosts** — `App-B4VcOATW.js`, `index-CLtZjYMv.js`, etc. (blocklisted + purged on device)

Run `npm run verify:lingering --strict` to scan for forbidden artifacts.

---

## Ghost build protection

| Layer | Protection |
|-------|------------|
| Bundled build | Phone loads `capacitor://` + `ios/public` only — CDN ghosts cannot load |
| `ghost-builds.txt` | 12 known stale CDN hashes blocklisted |
| `AppDelegate.swift` | WKWebView cache purge on BUILD_STAMP change + injected JS ghost blocker |
| Audit | `npm run audit:v87-improvements` + `npm run ghosts:audit-all` |

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run apply:v87-from-omega3` | Full bundled apply: v87 branch + Omega 3 gallery port + build |
| `npm run port:omega3-gallery` | Port gallery stack only (after git reset) |
| `npm run audit:v87-improvements` | Verify all improvements present, no regressions |
| `npm run verify:bundled-v87` | Bundled mode + v87 source checks |
| `npm run ghosts:discover` | Refresh CDN ghost scan + `ghost-builds.txt` |
| `npm run ghosts:audit-all` | Three-layer ghost/remnant audit |

See also: [V87-FROM-OMEGA3.md](./V87-FROM-OMEGA3.md), [OMEGA-3.md](./OMEGA-3.md)
