# Stripe payment — rebuild Android app (required)

The web/Base44 fix is live (`App-CTDy7dds.js`, v292 scrub). If payment still opens Chrome, the **Play Store APK** is navigating the main WebView to Stripe because `allowNavigation` included `stripe.com`.

Stripe must open only via **InAppBrowser** (in-app panel), not main WebView navigation.

## What changed

`capacitor.config.json` — removed Stripe hosts from `server.allowNavigation`.

This requires a **new AAB upload** to Play Console. Web-only publishes cannot fix this part.

## On your Mac

```bash
cd ~/restorebraine
git fetch origin
git checkout cursor/android-play-store-bacf
git pull origin cursor/android-play-store-bacf

# Merge latest Stripe web fix
git merge origin/cursor/fix-stripe-inapp-payment-bacf

npm install
npm run build:android
npm run android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Upload to **Play Console → Internal testing** (or Production). Bump `versionCode` in `scripts/write-build-info.mjs` first if needed.

## After Play Store update

1. Wait for Play Store to serve the new build (internal testing: opt-in link)
2. **Uninstall** old Restorebraine from phone
3. Install fresh from Play Store internal testing
4. Force-quit → reopen → try Pay

## Confirm you're in the native app

- App icon from Play Store / home screen — **not** Chrome or Safari
- In app, URL bar should **not** show (it's a WebView shell)

## Base44 (already done if bundle is App-CTDy7dds.js)

If not, paste in Base44 and Publish:

- `public/native-ui-scrub.js` (v293)
- `src/lib/stripe-checkout.js`
- `src/components/upload/PaymentModal.jsx`
- `src/main.jsx`

Verify:

```bash
curl -sL "https://restorebraine.base44.app/assets/index-D_XBffm6.js" | grep -oE 'assets/App-[A-Za-z0-9_-]+\.js'
```

Should **not** be `App-exbviQF4.js`.
