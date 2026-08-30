# Stripe payment — Base44 one-file fix (v289)

Live site is still **v286**. Payment opens Chrome because the old JS bundle calls
`openInSystemBrowser`. You only need to update **one file** that Base44 already serves.

## Tell Base44 AI (copy this entire block)

```
Update native-ui-scrub.js with the full file from my git repo at commit v289.
The file must include rbStripeInAppPatch at the bottom with openInSystemBrowser
redirecting to openInWebView for stripe.com URLs. Save the file and Publish.
Do not change index.html. After publish, native-ui-scrub.js must contain
the string openInSystemBrowser.
```

## Or paste manually (Mac)

```bash
cd ~/restorebraine
git pull origin cursor/fix-stripe-inapp-payment-bacf
pbcopy < public/native-ui-scrub.js
```

Base44 Code editor → **public/native-ui-scrub.js** (or **native-ui-scrub.js** at project root)
→ Select All → Paste → **Save** → **Publish once**

## Verify (must pass)

```bash
curl -sL "https://restorebraine.base44.app/native-ui-scrub.js" | grep openInSystemBrowser
```

Must print a line. Until this passes, payment will keep opening an external tab.

Deploy stamp may stay v286 — that is OK for this fix. The scrub file is what matters.

## Phone test

Force-quit Restorebraine → reopen → try Pay.
