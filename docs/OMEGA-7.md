# Omega 7 — bundled iOS archive (v107)

Known-good Restorebraine **bundled** build — login, gallery, and organize folder counts aligned.

| Item | Value |
|------|--------|
| **Git tag** | `omega-7` |
| **Branch** | `cursor/apple-privacy-plist-bacf` |
| **Build** | v107 |
| **Archive label** | **Omega 7** |
| **Build stamp** | `kbrown native v107 · Omega 7 · …` |
| **PR** | https://github.com/HereinElva/restorebraine/pull/17 |

## What this Omega includes

1. **Bundled Mac UI** — `capacitor://` ios/public (not hosted CDN)
2. **Login** — SignInScreen + NativeLoginCard; OAuth + email; no white-screen regressions (HashRouter, BootErrorBoundary)
3. **Organize** — 8-folder batch model; membership cache repair; empty-folder prune (UI count matches Done alert)
4. **No ghost empty folders** — Outdoor Activities 0-count folders deleted on organize + gallery load
5. **Regression gate** — `npm run verify:login-organize` in `build:native-local`

## Restore to Omega 7

```bash
cd ~/restorebraine
git fetch origin --tags
git checkout cursor/apple-privacy-plist-bacf
git reset --hard omega-7
npm install
npm run apply:v87-from-omega3 -- --skip-sync
npm run verify:login-organize
```

Then: **Delete app → Restart iPhone → Xcode Clean Build Folder → Run**

Confirm green bar:

`BUNDLED · kbrown native v107 · Omega 7 · index-*.js`

## Do not use for this archive

- `npm run fix:no-change` — switches to **hosted** CDN mode
- Plain `npm run build` — leaves `login-redirect.js` in bundled index (wrong login path)
