# Storage Payments Setup (Stripe + Apple IAP)

Restorebraine charges **$0.50 per 250 media files** after the first 250 free uploads.

| Platform | Payment method |
|----------|----------------|
| **Web browser** | Stripe Checkout |
| **iOS native app** | Apple In-App Purchase (required by App Store) |

## 1. Stripe (web)

1. In [Stripe Dashboard](https://dashboard.stripe.com), copy your **Secret key**.
2. In Base44 → app settings → **Secrets**, add:
   - `STRIPE_SECRET_KEY` = `sk_live_...` or `sk_test_...`
3. Deploy backend functions: `createCheckout`, `verifyPayment`, `verifyApplePurchase`.

## 2. Apple In-App Purchase (iOS App Store)

### App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com) → your app → **Features → In-App Purchases**.
2. Create a **Consumable** product:
   - **Product ID:** `com.restorebraine.storage.250`
   - **Reference name:** Storage 250 Files
   - **Price:** Tier matching **$0.49** or **$0.99** (Apple pricing tiers; closest to $0.50)
   - **Display name:** 250 Media Storage
   - **Description:** Unlock storage for 250 additional photos and videos.
3. Submit the IAP for review with your app.

### Xcode

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Select the **App** target → **Signing & Capabilities**.
3. Click **+ Capability** → add **In-App Purchase**.
4. Run `npm install` and `npx cap sync ios` after pulling this branch.

### Sandbox testing

1. App Store Connect → **Users and Access → Sandbox Testers** → create a test Apple ID.
2. On your iPhone: Settings → App Store → Sandbox Account → sign in with the tester.
3. Upload until you hit 250+ files; the payment popup should offer **Buy with App Store**.

### Optional receipt validation

Add to Base44 secrets for server-side Apple receipt checks:

- `APPLE_SHARED_SECRET` — from App Store Connect → App → App Information → Shared Secret
- `APPLE_SANDBOX=true` — use sandbox verify URL during testing

## 3. User field: `paid_tier`

Each successful payment increments the user's `paid_tier` by 1 (one block of 250 files).

Storage limit = `(paid_tier + 1) × 250`

Example: `paid_tier = 0` → 250 free; `paid_tier = 1` → 500 total; `paid_tier = 2` → 750 total.

## 4. Flow summary

1. User selects files on **Upload** tab.
2. If `currentCount + newFiles > limit`, **Storage Limit Reached** popup appears.
3. **iOS:** Apple IAP consumable purchase → `verifyApplePurchase` → `paid_tier++` → upload continues.
4. **Web:** Stripe Checkout → `PaymentSuccess` → `verifyPayment` → `paid_tier++`.
