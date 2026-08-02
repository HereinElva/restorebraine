# Omega archive

Known-good Restorebraine native iOS builds. Use these to revert if a later change breaks login, logout, or icons.

| Tag | Build stamp | Notes |
|-----|-------------|-------|
| `omega-v55` | `kbrown native v55` | Login worked; sign-out showed native overlay |
| `omega-v57` | `kbrown native v57` | Login + logout perfect; home screen icon still missing |
| **`omega-3`** | **`kbrown v4-core v261`** | **Bundled gallery/organize reference — folder persistence, PullToRefresh** |
| **`omega`** | **`kbrown native v58`** | **Hosted login, logout, official app icon** |
| **`v87-baseline`** | **v87** | **Hosted + SignedOutLanding + OAuth fix** |
| **`omega-7`** | **`kbrown native v107 · Omega 7`** | **Bundled login + organize; empty-folder prune; folder count matches alert** |

See [OMEGA-3.md](./OMEGA-3.md), [OMEGA-7.md](./OMEGA-7.md), and [V87-FROM-OMEGA3.md](./V87-FROM-OMEGA3.md) for bundled archive paths.

## Revert to Omega 7 (current bundled archive)

```bash
cd ~/restorebraine
git fetch origin --tags
git reset --hard omega-7
npm install
npm run apply:v87-from-omega3 -- --skip-sync
npm run verify:login-organize
```

## Revert to current Omega (hosted v58)

```bash
cd /Users/ari/Desktop/restorebraine
git fetch origin --tags
git reset --hard omega
bash scripts/mac-ios-setup.sh
```

## Revert to a specific archive entry

```bash
git reset --hard omega-v57   # logout fixed, icon issue
git reset --hard omega-v55   # earliest Omega baseline
```

Then run `bash scripts/mac-ios-setup.sh` and rebuild in Xcode.

## What Omega v58 includes

- Hosted app model (`server.url` → `https://restorebraine.base44.app`)
- OAuth login persists across restarts
- One-tap sign-out → original in-app login page
- Official Restorebraine brain icon fetched from CDN at build time
- `CFBundleIconName` + `CFBundleIcons` in Info.plist

## Home screen icon after install

1. Delete app from iPhone
2. **Restart iPhone** (iOS caches icons aggressively)
3. Xcode → Clean Build Folder → Run
4. In Xcode: App → Assets.xcassets → AppIcon — all slots should show the brain icon
