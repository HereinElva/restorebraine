# Start fresh — Omega reference + kept fixes

**Use this command** (Base44 first, then Capacitor):

```bash
cd ~/restorebraine
bash scripts/mac-resync-omega.sh
```

| Phase | Command | What it does |
|-------|---------|--------------|
| **1 — Base44** | `--base44-only` | Omega verify + generate `base44-publish-v*.txt` → you Publish |
| **2 — Native** | `--native-only` | Hosted Capacitor + full Xcode replace (after Phase 1 passes) |

Check Base44 drift: `node scripts/verify-base44-live.mjs`

Full pre-flight (Mac or CI): `npm run verify:resync`

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

## Why things broke (GitHub vs Base44 vs Capacitor)

Three copies of the app existed:

| Copy | What happened |
|------|----------------|
| **GitHub** | Updated every commit (now v178+) |
| **Base44 live site** | Stuck at **v162** — Publish never completed |
| **Capacitor iPhone** | Bundled localhost builds — third copy, broken OAuth |

Safari and hosted iPhone both load **Base44 live** — so they showed v162 old login (single Google button) while git had NativeLoginCard.

**Rule:** GitHub is the source of truth. Base44 only updates via **one full publish pack** — not piecemeal edits in the Base44 editor.

Check drift anytime:

```bash
node scripts/verify-base44-live.mjs
```

## After Phase 1 — Publish Base44

**Use the wizard** (do not open the giant txt file):

```bash
bash scripts/base44-publish-wizard.sh
```

One file at a time: Terminal copies → you Paste in Base44 → Save → Enter.

Guide: `docs/BASE44-PUBLISH.md`

Then verify:

```bash
node scripts/verify-base44-live.mjs
bash scripts/mac-resync-omega.sh --native-only
```

## After Phase 2 — Xcode

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
