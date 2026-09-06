# Sync Before Build — avoid ghost builds

Restorebraine uses **one hosted URL** (`https://restorebraine.base44.app`) inside Capacitor iOS/Android shells. Version numbers and configs must stay aligned across GitHub, Base44, Xcode, and Gradle.

## Single source of truth (use this branch)

```
cursor/fix-folder-persistence-bacf
```

Contains: folder persistence (v294), payment modal iPhone fix (v295), Stripe scrub v293, Capacitor configs **without** stripe.com in `allowNavigation`.

## Before any iOS or Android native build

On your Mac:

```bash
cd ~/restorebraine
git fetch origin
git checkout cursor/fix-folder-persistence-bacf
git pull origin cursor/fix-folder-persistence-bacf
git checkout -- android/ ios/App/App/BUILD_STAMP.txt 2>/dev/null || true
npm install
node scripts/sync-build-numbers.mjs
node scripts/verify-build-sync.mjs
bash scripts/mac-fix-build-stamp.sh
```

All checks must pass. **Do not run `write-build-info.mjs` unless you intentionally want to bump the version.**

## What each layer should show (current target: v295)

| Layer | File / check | Target |
|-------|----------------|--------|
| Base44 live | `curl … \| grep restorebraine-deploy` | **v295** |
| Stripe scrub live | `curl …/native-ui-scrub.js \| grep StripePatchVersion` | **293** |
| GitHub | `src/deploy-marker.js` | `DEPLOY_BUILD = 295` |
| Native | `src/lib/build-info.js` | `BUILD_NUMBER = 295` |
| Xcode | `CURRENT_PROJECT_VERSION` in pbxproj | **295** |
| BUILD_STAMP | `ios/App/App/BUILD_STAMP.txt` | v295 label |

## iOS (Xcode)

```bash
npm run ios:prepare    # or: bash scripts/mac-build.sh --hosted
npx cap sync ios
open ios/App/App.xcworkspace
```

Archive in Xcode only after `verify-build-sync` passes.

**Do not** merge `main` into your branch — `main` still has stripe.com in `allowNavigation`.

## Android (Play Store)

Android scripts live on `cursor/android-play-store-bacf`. Your **AAB is already built** — upload it unless you need a new version code.

If rebuilding:

```bash
git checkout cursor/android-play-store-bacf
git pull
node scripts/sync-build-numbers.mjs
npm run build:android
npm run android:bundle
```

## Base44 publish (web fixes — required for UI behavior)

GitHub alone does not update the live app. After code changes, paste into Base44 Code editor and **Publish once**:

1. `src/lib/folder-server-sync.js`
2. `src/lib/folder-membership.js`
3. `src/components/gallery/CustomFolderButton.jsx`
4. `src/components/upload/PaymentModal.jsx`
5. `public/native-ui-scrub.js`
6. `src/lib/stripe-checkout.js`
7. `src/main.jsx`
8. `index.html`
9. `src/deploy-marker.js`

Verify live bundle includes folder fix:

```bash
B=$(curl -s https://restorebraine.base44.app/ | grep -o 'index-[^"]*\.js' | head -1)
curl -s "https://restorebraine.base44.app/assets/$B" | grep -o 'claimOrphanedData\|withFolderOwner' | sort -u
```

## Ghost builds to avoid

| Mistake | Effect |
|---------|--------|
| Running `npm run build` on old branch | Re-injects stripe.com into capacitor config (fixed in latest branch) |
| Manual `DEPLOY_BUILD` bump without `sync-build-numbers.mjs` | Xcode shows v282, Base44 shows v295 |
| Building Xcode without `ios/App/App/public/` | Stale or empty bundle |
| Testing Stripe in Safari/Chrome | External browser is expected — test in App Store / Play Store app |
| `git reset` on android branch without pulling | Missing `build:android` scripts |

## Safe order for your current situation

1. **Do not rebuild** unless needed — Base44 is v295/293, Android AAB is done.
2. Pull `cursor/fix-folder-persistence-bacf` + run sync script above.
3. Fix Xcode: `bash scripts/mac-fix-build-stamp.sh`
4. Publish **folder** files to Base44 if `claimOrphanedData` not in live bundle.
5. Upload existing `app-release.aab` to Play Console internal testing.
