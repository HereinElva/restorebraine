# Stripe payment — Base44 one-file fix (v290)

Your v289 scrub patch **is live** but payment still failed because the app imports
InAppBrowser as an ES module — v289 only patched `Capacitor.Plugins`, not the module.

**v290** hooks `Capacitor.registerPlugin` and re-wraps navigation after the old guard.

## One file — paste in Base44

```bash
cd ~/restorebraine
git pull origin cursor/fix-stripe-inapp-payment-bacf
pbcopy < public/native-ui-scrub.js
```

Base44 → **native-ui-scrub.js** → Select All → Paste → **Save** → **Publish**

## Verify (must show 290)

```bash
curl -sL "https://restorebraine.base44.app/native-ui-scrub.js" | grep __restorebraineStripePatchVersion
```

Expected: `window.__restorebraineStripePatchVersion = 290`

## Phone

Force-quit → reopen → Pay again.
