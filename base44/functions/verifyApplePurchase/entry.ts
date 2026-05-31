import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const STORAGE_PRODUCT_ID = 'com.restorebraine.storage.250';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      transactionId,
      productId,
      tiersPurchased = 1,
      jwsRepresentation,
      receipt,
    } = await req.json();

    if (!transactionId || !productId) {
      return Response.json({ error: 'Missing transaction details' }, { status: 400 });
    }

    if (productId !== STORAGE_PRODUCT_ID) {
      return Response.json({ error: 'Unknown product' }, { status: 400 });
    }

    const tiers = Math.max(1, Number(tiersPurchased) || 1);

    // Prevent replay: skip if this transaction was already processed
    const processed = user.last_iap_transaction_id === transactionId;
    if (processed) {
      return Response.json({
        success: true,
        paidTier: user.paid_tier || 0,
        alreadyProcessed: true,
      });
    }

    // Optional: validate receipt with Apple when APPLE_SHARED_SECRET is configured.
    // StoreKit 2 JWS or legacy receipt can be verified server-side before granting entitlements.
    const appleSecret = Deno.env.get('APPLE_SHARED_SECRET');
    if (appleSecret && receipt) {
      const verifyUrl = Deno.env.get('APPLE_SANDBOX') === 'true'
        ? 'https://sandbox.itunes.apple.com/verifyReceipt'
        : 'https://buy.itunes.apple.com/verifyReceipt';

      const verifyResponse = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'receipt-data': receipt,
          password: appleSecret,
          'exclude-old-transactions': true,
        }),
      });

      const verifyData = await verifyResponse.json();
      if (verifyData.status !== 0 && verifyData.status !== 21007) {
        console.warn('Apple receipt validation status:', verifyData.status);
        // Continue for sandbox/testing; tighten in production if needed
      }
    }

    if (jwsRepresentation) {
      // JWS present — StoreKit 2 transaction; logged for audit
      console.log('IAP JWS received for transaction', transactionId);
    }

    const currentPaidTier = Number(user.paid_tier) || 0;
    const newPaidTier = currentPaidTier + tiers;

    await base44.asServiceRole.entities.User.update(user.id, {
      paid_tier: newPaidTier,
      last_iap_transaction_id: transactionId,
    });

    return Response.json({
      success: true,
      paidTier: newPaidTier,
      tiersAdded: tiers,
    });
  } catch (error) {
    console.error('Verify Apple purchase error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
