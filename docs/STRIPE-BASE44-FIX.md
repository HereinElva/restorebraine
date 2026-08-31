# Stripe payment — v292

## Status

- **v291 scrub is live** but payment may still open Chrome if the bridge hook missed Capacitor init.
- **v292** keeps the bridge hook running permanently and also hooks `Browser.open`.

## Step A — one file (scrub)

```bash
git pull origin cursor/fix-stripe-inapp-payment-bacf
pbcopy < public/native-ui-scrub.js
```

Base44 → **native-ui-scrub.js** → Save → **Publish**

Verify:

```bash
curl -sL "https://restorebraine.base44.app/native-ui-scrub.js?v=$(date +%s)" | grep __restorebraineStripePatchVersion
```

Must show **292**.

## Step B — rebuild App bundle (recommended)

The live App bundle still calls `openInSystemBrowser` first. Paste these 3 files in Base44, Save each, **Publish once**:

```bash
bash scripts/base44-stripe-bundle-publish.sh
```

Files:

1. `src/lib/stripe-checkout.js`
2. `src/components/upload/PaymentModal.jsx`
3. `src/main.jsx`

After Publish, App bundle filename should change (not `App-exbviQF4.js`).

## Phone test

- Use the **Play Store / App Store app**, not Safari/Chrome
- Force-quit → reopen → Pay

## If still broken

The Play Store APK/AAB may need rebuild with `@capacitor/inappbrowser`:

```bash
git checkout cursor/android-play-store-bacf
npm install
npx cap sync android
bash scripts/android:bundle   # or your AAB build script
```

Upload new AAB to Play Console internal testing.
