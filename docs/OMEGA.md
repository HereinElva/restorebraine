# Omega archive — v4-core reference build

Known-good Restorebraine builds. **Use this baseline so login/auth experiments do not interfere** with gallery navigation, folder tiles, or account UI.

## Current Omega (v4-core) — use this

| Item | Value |
|------|--------|
| **Git tag** | `omega-v4-core` |
| **Commit** | `ec86e42` |
| **Deploy stamp** | `kbrown native v80` / `restorebraine web v80` |
| **App Store lineage** | `MARKETING_VERSION 1.0.1`, `CURRENT_PROJECT_VERSION 4` (first re-upload after old build pulled) |

### What this Omega includes (do not regress)

1. **Back to Gallery** (v69–v70) — Account page link uses `data-rb-gallery-nav`; no sign-out interceptor on gallery taps
2. **Folder action aesthetics** (v71–v79) — compact white tiles, purple Organize label, shared `folderActionStyles.js`
3. **MobileGallery white-screen fix** (v80) — no `build-info.js` import in gallery bundle
4. **Session restore on gallery nav** — `navigateToGallery` + `resumeActiveSession`

### Protected files (must match Omega unless explicitly requested)

```
src/components/gallery/folderActionStyles.js
src/components/gallery/OrganizeButton.jsx
src/components/gallery/CustomFolderButton.jsx
src/components/gallery/MobileGallery.jsx   (except DEPLOY_BUILD import — OK)
src/lib/gallery-nav.js
src/pages/Account.jsx                    (gallery nav + data-rb-gallery-nav; logout may evolve)
src/Layout.jsx                           (gallery tab + back nav; header logo may evolve)
```

Verify anytime:

```bash
node scripts/verify-omega-baseline.mjs
```

### Revert gallery/folders/account nav to Omega only

```bash
git fetch origin --tags
git checkout omega-v4-core -- \
  src/components/gallery/folderActionStyles.js \
  src/components/gallery/OrganizeButton.jsx \
  src/components/gallery/CustomFolderButton.jsx \
  src/components/gallery/MobileGallery.jsx \
  src/lib/gallery-nav.js
# Account.jsx / Layout.jsx: merge manually — logout and header logo may differ from v80
```

Then rebuild: `bash scripts/mac-capacitor-web-sync.sh` and **Xcode → Run**.

### App Store / TestFlight (use hosted — NOT bundled)

Old Omega (`omega` tag, v58) loaded live `restorebraine.base44.app` — login worked without Base44 paste marathons.

**Before every Archive:**

```bash
bash scripts/mac-appstore-deploy.sh
bash scripts/mac-pre-upload-checklist.sh
# Xcode → Clean → Archive → Upload
```

Do **not** run `mac-ios-v4-deploy.sh` or `mac-capacitor-web-sync.sh` before App Store upload — those bundle `capacitor://localhost` and break login on TestFlight.

**Reference build:** App Store Connect **1.0.1 (3)** — see [APPSTORE-BUILD-1.0.1-3.md](./APPSTORE-BUILD-1.0.1-3.md). Reconstruct with `bash scripts/mac-reconstruct-appstore.sh`.

---

## Legacy Omega (hosted WebView — pre v4-core)

Older tags from before bundled `capacitor://localhost`. **Do not use for current iPhone deploy.**

| Tag | Build stamp | Notes |
|-----|-------------|-------|
| `omega-v55` | `kbrown native v55` | Login worked; sign-out overlay |
| `omega-v57` | `kbrown native v57` | Login + logout; home icon issue |
| `omega` | `kbrown native v58` | Hosted WebView + CDN icon |

```bash
git reset --hard omega   # legacy only — not v4-core
```

---

## What may change without touching Omega UI

- Login / OAuth / `SignInScreen` / `NativeLoginCard` (native auth layer)
- Launch screen storyboard + splash assets
- Logout server redirect (web)
- Build stamp / deploy number (v81+)

**Rule:** run `node scripts/verify-omega-baseline.mjs` before every iPhone or Base44 publish.
