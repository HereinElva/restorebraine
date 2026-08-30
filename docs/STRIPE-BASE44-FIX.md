# Stripe payment — v291 (Capacitor bridge hook)

v290 is live but payment still opens Chrome because the bundled Capacitor core
calls `toNative('InAppBrowser', 'openInSystemBrowser', ...)` directly — bypassing
registerPlugin patches.

**v291** hooks `Capacitor.toNative` and `Capacitor.nativePromise` at the bridge.

## Base44 — one file

```bash
git pull origin cursor/fix-stripe-inapp-payment-bacf
pbcopy < public/native-ui-scrub.js
```

Paste into **native-ui-scrub.js** → Save → **Publish**

## Verify

```bash
curl -sL "https://restorebraine.base44.app/native-ui-scrub.js" | grep __restorebraineStripePatchVersion
```

Must show **291**.

```bash
curl -sL "https://restorebraine.base44.app/native-ui-scrub.js" | grep toNative
```

Must print a line with `cap.toNative`.

## Phone

Force-quit → reopen → Pay.

## Also paste when you can (full fix)

These rebuild the App bundle so you don't rely on the scrub hook:

- `src/lib/stripe-checkout.js`
- `src/components/upload/PaymentModal.jsx`
- `src/main.jsx`
