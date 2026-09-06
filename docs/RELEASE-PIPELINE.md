# Release pipeline — GitHub → Base44 → Capacitor → Mobile

Hosted iOS and Android load **`https://restorebraine.base44.app`** at runtime. The native shell is a thin Capacitor wrapper; **all UI logic ships through Base44 Publish**.

## One command check

```bash
node scripts/verify-release-pipeline.mjs
```

Must **PASS** before TestFlight / Play Store upload. For bundled native-only builds:

```bash
node scripts/verify-release-pipeline.mjs --bundled
```

## Architecture (hosted — current App Store / Play Store)

```
GitHub (source)  →  Base44 Publish  →  restorebraine.base44.app
                                              ↑
Capacitor iOS/Android WebView loads this URL
```

| Layer | What it controls | Ghost-build risk |
|-------|------------------|------------------|
| **GitHub** | Source code, version numbers, Capacitor config | Wrong branch, `npm run build` auto-bump |
| **Base44** | Live JS bundle users actually run | Partial publish (meta only, stale `index-mlcqt5ef.js`) |
| **Capacitor** | `server.url`, `allowNavigation`, native plugins | stripe.com in allowNavigation, config drift |
| **Xcode / Gradle** | Store version, signing, shell install | Stale `ios/public`, Run without DEPLOY OK |

## What is OK right now (v295)

- GitHub: all source files present, `npm run build:web` succeeds, dist has all markers
- Capacitor: no stripe.com, configs aligned, hosted URL correct
- Mac scripts: default branch `cursor/fix-folder-persistence-bacf`, hosted rebuild uses `build:web` (no ghost bump)

## What blocks mobile today

Run `node scripts/audit-base44-bundle.mjs` — if it **PASS**es, Base44 is not the blocker.

When hosted audits pass but the **native app** still shows old behavior, the usual causes are:

1. **WKWebView cache** — Base44 published a new bundle but `BUILD_STAMP` on the installed app did not change, so iOS keeps cached JS from `restorebraine.base44.app`.
2. **Wrong shell mode** — `mac-build.sh` without `--hosted` ships bundled `capacitor://localhost` (ignores Base44 entirely).
3. **Wrong branch** — e.g. `cursor/fix-apple-sign-in-bacf` re-adds `stripe.com` to `allowNavigation`.
4. **Xcode never installed** — Omega check blocked `mac-build.sh`, or Run failed before `Restorebraine DEPLOY OK`.

Diagnose on Mac: `bash scripts/mac-diagnose-mobile.sh`

## Safe release order

```bash
# 1. Sync GitHub
git checkout cursor/fix-folder-persistence-bacf
git pull origin cursor/fix-folder-persistence-bacf
node scripts/sync-build-numbers.mjs
node scripts/verify-build-sync.mjs

# 2. Publish web (required for hosted mobile)
bash scripts/base44-publish-wizard.sh
# Save all files in Base44 → Publish once

# 3. Verify pipeline
node scripts/verify-release-pipeline.mjs   # must PASS

# 4. iOS App Store / TestFlight
bash scripts/mac-fix-build-stamp.sh
bash scripts/mac-build.sh --hosted --no-git
# Xcode: Clean → Archive → Upload

# 5. Android (AAB already built — upload unless version rejected)
# Play Console → internal testing → app-release.aab
```

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| v295 badge, no folder/payment change | Base44 partial publish | Full wizard + Publish |
| Payment opens Chrome | stripe.com in allowNavigation or old scrub | Use fix-folder-persistence-bacf branch |
| Xcode v282, Base44 v295 | Version drift | `sync-build-numbers.mjs` |
| iPhone unchanged after Archive | Xcode didn't copy public/ | Build log must show DEPLOY OK |
| `npm run build` bumped to v296 | write-build-info auto-increment | Use `build:web` + sync |
| mac-build pulled wrong branch | Old default branch | Now defaults to fix-folder-persistence-bacf |

## Bundled vs hosted

| Mode | UI source | Base44 required? |
|------|-----------|------------------|
| **Hosted** (`--hosted`, App Store default) | Live Base44 URL | **Yes — must Publish first** |
| **Bundled** (`--bundled`, dev/testing) | Full app in `ios/public` | No — git build is enough |
