# Base44 Publish — avoid "no change"

**GitHub pushes do NOT update the live app.** Base44 serves a **pre-built Vite bundle**. Updating only `index.html` or `deploy-marker.js` changes the **v295 meta tag** but leaves the **same JS file** — that is the #1 "no change" trap.

## Audit before and after Publish

```bash
cd ~/restorebraine
git pull origin cursor/fix-folder-persistence-bacf
node scripts/audit-base44-bundle.mjs
```

**Pass criteria after Publish:**

- Deploy meta: `v295`
- Bundle hash: **NOT** `index-mlcqt5ef.js` (must be a new hash)
- Bundle contains: `claimOrphanedData`, `data-rb-payment-modal`, `openInWebView`

## Critical files (v295 folder + payment fixes)

These were **missing from old publish wizards** — create in Base44 if they do not exist:

| File | Why |
|------|-----|
| `src/lib/folder-server-sync.js` | **NEW** — folder persistence after reinstall |
| `src/lib/folder-membership.js` | Uses `withFolderOwner` |
| `src/lib/run-media-organize.js` | Base44 asked for this — organize flow |
| `src/components/gallery/CustomFolderButton.jsx` | Creates folders with owner |
| `src/components/upload/PaymentModal.jsx` | iPhone-safe payment sheet |
| `src/lib/stripe-checkout.js` | In-app Stripe (no external browser) |
| `src/pages/Account.jsx` | Delete scoped by `created_by` |
| `public/native-ui-scrub.js` | Stripe v293 scrub |
| `index.html` | Inline Stripe guard + deploy meta |
| `src/deploy-marker.js` | `DEPLOY_BUILD = 295` |

## Run the wizard (recommended)

```bash
bash scripts/base44-publish-wizard.sh --list   # full checklist
bash scripts/base44-publish-wizard.sh          # one file at a time
```

Paste each file → **Save** in Base44 Code editor. Click **Publish once** at the end.

## Ghost builds elsewhere

| Location | Symptom | Fix |
|----------|---------|-----|
| Base44 CDN | `App-CTDy7dds.js` still HTTP 200 (orphan) | Harmless if not in index.html; new publish replaces bundle |
| Base44 partial publish | Meta v295 but bundle `index-mlcqt5ef.js` | Paste all files above → Publish |
| Mac `npm run build` | Auto-bumps version | Use `npm run build:web` or `sync-build-numbers.mjs` first |
| `use-local-native-bundle.mjs` | Re-injected stripe.com | Fixed — verify with `npm run verify:build-sync` |
| iOS hosted WebView | Loads Base44 URL | Web publish must succeed first |

## After Publish

```bash
node scripts/audit-base44-bundle.mjs
npm run verify:base44
```

## Then native app (optional)

```bash
bash scripts/mac-start-fresh.sh
open ios/App/App.xcworkspace
```

Hosted iOS/Android load `https://restorebraine.base44.app` — web publish is what users see until you archive a new native build.
