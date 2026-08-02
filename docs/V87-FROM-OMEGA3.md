# v87 from Omega 3 — reference lineage

Use **Omega 3** as the archived proof that gallery, organize, folders, and upload worked. Use **v87** as the current hosted target with login/OAuth fixes.

## Tags

| Tag | Build | Role |
|-----|-------|------|
| `omega-3` | v261 bundled | **Gallery/organize reference** — folder persistence, PullToRefresh, multi-batch organize |
| `omega` | v58 hosted | Login/logout/icon reference (pre-v87) |
| `v87-baseline` | v87 | **Current target** — hosted + SignedOutLanding + OAuth fix (`f1b2505`) |

## Omega 3 → v87 corrections (in order)

These commits sit between `omega-3` and `f1b2505`:

1. **17af6de** — App Store privacy plist (5.1.1)
2. **6c15e97** — v82 compact AI consent + fast upload pipeline
3. **390928b** — v83 `native-media-input` for iOS upload picker
4. **698975e** — Restore **hosted** Capacitor (OAuth + session persistence)
5. **5762b16** — v87 UI: `SignedOutLanding` ("Find Your Memories" + Sign In)
6. **f1b2505** — v87 tip: OAuth on `restorebraine.base44.app` (not `app.base44.com` 404)

## Architecture: why Omega 3 on phone ≠ v87 on phone

| | Omega 3 | v87 |
|---|---------|-----|
| Phone loads | Bundled `ios/public` | Live `https://restorebraine.base44.app` |
| Gallery source | Mac `npm run build` | Base44 **Publish** of full source manifest |
| Xcode alone fixes UI? | Yes (bundled) | **No** — must Publish App chunk |

v87 **keeps** Omega 3 gallery source files in git but serves them from Base44. Until **full Publish**, live `App-*.js` stays stale (`App-B4VcOATW.js`).

## Full Base44 publish (Omega 3 gallery + v87 auth)

Old checklist was **43 files** and **missed 11 gallery deps** (PullToRefresh, PhotoModal, NavigationContext, `media-organize.js`, etc.). That caused mixed publish: OAuth fixed, gallery/CSS stale.

```bash
npm run omega:v87-ref          # print this lineage + file counts
npm run verify:manifest        # confirm manifest complete
npm run base44:export-pack     # paste ALL files → Publish once
npm run align:watch            # wait until App chunk changes
npm run diagnose:chunks        # must pass
```

## Restore commands

**Omega 3 gallery + all v87 corrections — bundled on iPhone (recommended after omega-3 works):**
```bash
cd ~/restorebraine
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm install
npm run apply:v87-from-omega3
# Xcode: Delete app → Clean Build Folder → Run
npm run verify:bundled-v87   # optional check
```

Same as `npm run revert:terminal -- --bundled-v87`, with explicit Omega 3 → v87 messaging and bundled verify.

Full inventory of included/excluded improvements: [V87-IMPROVEMENTS-AUDIT.md](./V87-IMPROVEMENTS-AUDIT.md)

**Reference only (bundled Omega 3, no v87 UI/OAuth fixes):**
```bash
git fetch origin --tags
git reset --hard omega-3
bash build-iphone.sh --no-git
```

**Production target (hosted v87):**
```bash
git fetch origin cursor/apple-privacy-plist-bacf
git reset --hard origin/cursor/apple-privacy-plist-bacf
npm run align:all
# Base44 Publish (browser) + align:watch
npm run prompt:replace-app
# Xcode Clean → Run
```

See also: [OMEGA-3.md](./OMEGA-3.md), [OMEGA.md](./OMEGA.md)
