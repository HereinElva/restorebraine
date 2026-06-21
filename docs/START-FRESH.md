# Start fresh — Omega reference + kept fixes

One terminal workflow to reset Restorebraine to the **Omega hosted architecture** (login worked), while **keeping** launch screen, Back to Gallery, and folder-tab button fixes.

## What this restores

| From Omega / build 1.0.1 (3) | Status |
|------------------------------|--------|
| Hosted Capacitor (`server.url` → `restorebraine.base44.app`) | ✅ |
| Login = same as Safari (after Base44 Publish) | ✅ |
| Full replace on every Xcode build (`rm -rf` + `ditto` entire `public/`) | ✅ |

## What this keeps (not reverted)

| Fix | Where |
|-----|--------|
| Launch screen — logo, light gradient, white title | `LaunchScreen.storyboard`, `generate-ios-launch-screen.mjs` |
| Back to Gallery — no logout | `Account.jsx` + `data-rb-gallery-nav` |
| Folder tab buttons | `omega-v4-core` gallery files |
| NativeLoginCard (Google / Apple / email) | `SignInScreen.jsx`, Base44 publish |

## One command (Terminal)

```bash
bash scripts/mac-start-fresh.sh
```

Already synced? Skip git reset:

```bash
bash scripts/mac-start-fresh.sh --no-git
```

This runs:

1. Sync to latest branch  
2. `verify-omega-baseline` + `verify-auth`  
3. Full wipe + **hosted** rebuild (`mac-xcode-full-replace.sh`)  
4. Generate `base44-publish-v{N}.txt`  
5. Pre-upload checklist  

## After the script — you do two things

### A. Base44 (web must match Capacitor)

```bash
bash scripts/base44-publish-copy-commands.sh
```

Paste every file → **Publish once**.

Verify in Safari: https://restorebraine.base44.app

### B. Xcode (full replace into App.app)

```bash
open ios/App/App.xcworkspace
```

1. **Clean Build Folder**  
2. **Run** on iPhone — search build log for `Restorebraine DEPLOY OK`  
3. **Archive** → Upload  

```bash
bash scripts/verify-hosted-app-bundle.sh
```

## Architecture (three targets)

```
┌─────────────────────┐     Publish      ┌──────────────────────────┐
│  Git repo (src/)    │ ───────────────► │  Base44 hosted web       │
│                     │                  │  restorebraine.base44.app│
└─────────┬───────────┘                  └────────────┬─────────────┘
          │                                           │
          │ npm run build (hosted)                      │ same UI + login
          ▼                                           │
┌─────────────────────┐     server.url                  │
│  ios/App/App/public │ ────────────────────────────────┘
└─────────┬───────────┘
          │ Xcode: FULL REPLACE every build
          ▼
┌─────────────────────┐
│  iPhone / TestFlight│
└─────────────────────┘
```

Capacitor **does not** bundle login UI for App Store — it opens the live Base44 site (Omega model).

## Do not use for App Store

```bash
# DEV ONLY — breaks TestFlight login
bash scripts/mac-capacitor-web-sync.sh
bash scripts/mac-ios-v4-deploy.sh
```

## References

- Gallery baseline: `omega-v4-core` — `node scripts/verify-omega-baseline.mjs`
- App Store build 3: `docs/APPSTORE-BUILD-1.0.1-3.md`, tag `appstore-1.0.1-build3`
- Legacy hosted Omega: tag `omega` (v58)
