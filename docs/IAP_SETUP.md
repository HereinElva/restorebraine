# Storage Payments Setup (Stripe + Apple IAP)

Restorebraine charges **$0.50 per 250 media files** after the first 250 free uploads.

## Primary: Stripe (web version)

**Stripe is synchronized with the hosted web app** at `https://restorebraine.base44.app`.

This applies to:
- Users in a desktop or mobile **browser**
- The **iOS native app** (Capacitor loads the same hosted URL in a WebView)

Both use the same Stripe Checkout flow and the same `paid_tier` on the user account.

### Stripe setup

1. In [Stripe Dashboard](https://dashboard.stripe.com), copy your **Secret key**.
2. In Base44 → app settings → **Secrets**, add:
   - `STRIPE_SECRET_KEY` = `sk_live_...` or `sk_test_...`
3. Deploy backend functions: `createCheckout`, `verifyPayment`, `verifyApplePurchase`.

After payment, Stripe redirects back to:
- Success: `https://restorebraine.base44.app/PaymentSuccess?session_id=...`
- Cancel: `https://restorebraine.base44.app/Upload`

## Optional: Apple IAP (standalone native bundle only)

Apple In-App Purchase is **only used** if the app runs as a local native bundle (not loading the hosted web URL). With the current Capacitor config (`server.url: https://restorebraine.base44.app`), **Stripe handles all payments**.

If you later ship a fully bundled native app without the hosted URL, configure IAP:

1. App Store Connect → **Consumable** product ID: `com.restorebraine.storage.250`
2. Xcode → **In-App Purchase** capability
3. Optional secret: `APPLE_SHARED_SECRET` for receipt validation

## User field: `paid_tier`

Each successful payment (Stripe or IAP) increments `paid_tier` by 1.

Storage limit = `(paid_tier + 1) × 250`

| paid_tier | Storage limit |
|-----------|---------------|
| 0 | 250 (free) |
| 1 | 500 |
| 2 | 750 |

## Flow

1. User selects files on **Upload** tab.
2. If upload would exceed limit → **Storage Limit Reached** popup.
3. **Pay with Stripe** → in-app checkout sheet on iOS/Android (InAppBrowser), or same-tab checkout on web → return to app → `verifyPayment` → upload continues.

Both web and iOS (hosted URL) share the same Stripe account and user `paid_tier`.
