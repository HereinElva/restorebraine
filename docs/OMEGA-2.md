# Omega 2 — bundled iOS reference (v217)

Known-good Restorebraine **bundled** build archived before the next iPhone rebuild cycle.

| Item | Value |
|------|--------|
| **Git tag** | `omega-2` |
| **Branch** | `cursor/fix-native-localhost-oauth-bacf` |
| **Commit** | `4cb3a57` |
| **Build** | v217 |
| **Deploy stamp** | `kbrown v4-core v217 · 2026-06-21 20:12` |
| **Entry JS** | `index-BeQG_nt-.js` |

## What this Omega includes

1. **iOS upload fix** — camera roll picker, Info.plist permissions, native media input recovery
2. **Upload Complete banner** — always below Add from Camera Roll
3. **Gallery tabs** — All/Folders scroll with content (not sticky)
4. **Gallery spacing** — tighter gap between search bar and tabs
5. **Organize (local)** — sorts unsorted Recents using existing photo tags; **no LLM calls by default** (avoids rate-limit popup)
6. **Back to Gallery** — Account page navigation with iOS WebView fallback
7. **Gallery preload** — media loads without pull-to-refresh
8. **Build scripts** — `build-iphone.sh`, stale bundle wipe, verify order fixes

## Restore to Omega 2

```bash
cd ~/restorebraine
git fetch origin --tags
git checkout cursor/fix-native-localhost-oauth-bacf
git reset --hard omega-2
bash build-iphone.sh --no-git
```

Xcode: delete app → Clean Build Folder → Run. Confirm log shows `Restorebraine DEPLOY OK` and **v217**.

## Hard reset to tag only

```bash
git fetch origin --tags
git reset --hard omega-2
```

## Relation to omega-v4-core

| Tag | Role |
|-----|------|
| `omega-v4-core` | Gallery/folder **UI baseline** (v80) — protected by `verify-omega-baseline.mjs` |
| `omega-2` | Full **app snapshot** (v217) — upload, organize, gallery layout, native fixes |

Omega 2 is the recommended restore point for bundled iPhone builds after the v208–v217 fix series.

## PR

https://github.com/HereinElva/restorebraine/pull/12
