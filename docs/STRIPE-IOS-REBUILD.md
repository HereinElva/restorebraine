# Stripe payment on iPhone

## First: are you in the App Store app or a browser?

| Where you are | What happens on Pay |
|---------------|---------------------|
| **Safari or Chrome** on iPhone | Stripe opens in the browser (often Chrome if that is your default browser). **Expected.** Web fixes do not apply. |
| **Restorebraine from the App Store** (home screen icon, no URL bar) | Stripe should open **inside the app** (sheet with Done/Cancel). If Chrome opens, rebuild the iOS app (below). |

### How to tell

- **Browser:** you see Safari/Chrome URL bar, tabs, or you opened a link from email/web
- **Native app:** full-screen Restorebraine, no browser chrome, installed from App Store

**Do not test payment in Safari or Chrome.** Use the App Store app only.

---

## If you are in the App Store app and Chrome still opens

The iOS shell still allows the main WebView to navigate to `stripe.com`. Stripe must open via **InAppBrowser** only.

`capacitor.config.json` removed Stripe from `allowNavigation`. You must **rebuild in Xcode** and upload to TestFlight/App Store.

### On your Mac

```bash
cd ~/restorebraine
git fetch origin
git pull origin cursor/fix-stripe-inapp-payment-bacf

npm install
npm run ios:prepare
# or: npm run build

npx cap sync ios
open ios/App/App.xcworkspace
```

In Xcode:

1. **Product → Clean Build Folder**
2. Select your iPhone or **Any iOS Device**
3. **Product → Archive**
4. Upload to **TestFlight** (or run directly on your iPhone with cable)

On iPhone:

1. Install the new build from TestFlight (or run from Xcode)
2. **Delete** the old Restorebraine app first if versions conflict
3. Force-quit → reopen → try Pay

---

## Base44 (web — already done if bundle is App-CTDy7dds.js)

Hosted JS is fixed. iPhone still needs the native shell rebuild above.

Verify web bundle:

```bash
curl -sL "https://restorebraine.base44.app/assets/index-D_XBffm6.js" | grep -oE 'assets/App-[A-Za-z0-9_-]+\.js'
```

Should show `App-CTDy7dds.js` or newer (not `App-exbviQF4.js`).
