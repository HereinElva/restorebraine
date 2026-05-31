import React, { useEffect, useState } from "react";
import { X, CreditCard, Check, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import {
  MEDIA_PER_TIER,
  PRICE_PER_TIER_USD,
  getStorageLimit,
  getAmountDue,
} from "@/lib/storage-billing";
import { shouldUseStripeCheckout, getStripeReturnBaseUrl } from "@/lib/native-platform";
import { openStripeCheckout } from "@/lib/stripe-checkout";
import {
  initializeInAppPurchases,
  isInAppPurchaseAvailable,
  loadStorageProduct,
  purchaseStorageTiers,
} from "@/lib/in-app-purchase";

export default function PaymentModal({
  currentPhotoCount,
  pendingUploadCount = 0,
  currentPaidTier = 0,
  tiersNeeded = 1,
  onClose,
  onPaymentComplete,
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [useIap, setUseIap] = useState(false);
  const [iapPrice, setIapPrice] = useState(null);

  const tiers = Math.max(1, tiersNeeded);
  const amountDue = getAmountDue(tiers);
  const currentLimit = getStorageLimit(currentPaidTier);
  const newLimit = getStorageLimit(currentPaidTier + tiers);
  const projectedTotal = currentPhotoCount + pendingUploadCount;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (shouldUseStripeCheckout()) return;
      const available = await isInAppPurchaseAvailable();
      if (cancelled) return;
      setUseIap(available);
      if (available) {
        await initializeInAppPurchases();
        const product = await loadStorageProduct();
        if (!cancelled && product?.priceString) {
          setIapPrice(product.priceString);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStripePayment = async () => {
    setError(null);
    setProcessing(true);
    try {
      const response = await base44.functions.invoke("createCheckout", {
        amount: amountDue,
        tiersPassed: tiers,
        returnUrl: getStripeReturnBaseUrl(),
      });
      if (response.data?.url) {
        await openStripeCheckout(response.data.url);
        return;
      }
      throw new Error("Failed to create checkout session");
    } catch (err) {
      console.error("Stripe payment error:", err);
      setError(err.message || "Failed to start checkout. Please try again.");
      setProcessing(false);
    }
  };

  const handleIapPayment = async () => {
    setError(null);
    setProcessing(true);
    try {
      const user = await base44.auth.me();
      const transaction = await purchaseStorageTiers(tiers, user?.id);

      const response = await base44.functions.invoke("verifyApplePurchase", {
        transactionId: transaction.transactionId,
        productId: transaction.productIdentifier,
        tiersPurchased: tiers,
        jwsRepresentation: transaction.jwsRepresentation,
        receipt: transaction.receipt,
      });

      if (!response.data?.success) {
        throw new Error(response.data?.error || "Could not verify App Store purchase");
      }

      onPaymentComplete?.(response.data.paidTier);
    } catch (err) {
      console.error("IAP payment error:", err);
      const message = String(err?.message || err || "");
      if (/cancel/i.test(message)) {
        setError("Purchase cancelled.");
      } else {
        setError(message || "In-app purchase failed. Please try again.");
      }
      setProcessing(false);
    }
  };

  const handlePayment = () => {
    if (useIap) return handleIapPayment();
    return handleStripePayment();
  };

  const payLabel = useIap
    ? iapPrice
      ? `Buy ${tiers > 1 ? `${tiers} × ` : ""}${iapPrice}`
      : `Buy with App Store`
    : `Pay $${amountDue.toFixed(2)}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card
        className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              {useIap ? (
                <Smartphone className="w-6 h-6 text-purple-600" />
              ) : (
                <CreditCard className="w-6 h-6 text-purple-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Storage Limit Reached</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-gray-100 rounded-full"
            disabled={processing}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            You have <span className="font-semibold text-purple-600">{currentPhotoCount}</span> files stored
            {pendingUploadCount > 0 && (
              <>
                {" "}
                and are adding{" "}
                <span className="font-semibold text-purple-600">{pendingUploadCount}</span> more
              </>
            )}
            .
          </p>
          <p className="text-gray-600">
            Your current limit is {currentLimit} files. To continue, unlock{" "}
            <span className="font-semibold">{tiers * MEDIA_PER_TIER}</span> more slots for{" "}
            <span className="font-bold text-gray-900">${amountDue.toFixed(2)}</span>
            {useIap ? " via App Store In-App Purchase" : " via Stripe"}.
          </p>
          {projectedTotal > currentLimit && (
            <p className="text-sm text-orange-600 mt-2">
              Upload would reach {projectedTotal} files, which exceeds your {currentLimit}-file limit.
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Pricing</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">First {MEDIA_PER_TIER} files</span>
              <span className="text-gray-900 font-medium">Free</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Every {MEDIA_PER_TIER} files after</span>
              <span className="text-gray-900 font-medium">${PRICE_PER_TIER_USD.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-purple-200 flex items-center justify-between font-semibold">
              <span className="text-gray-900">Amount due</span>
              <span className="text-purple-600 text-lg">${amountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <Button variant="outline" onClick={onClose} disabled={processing} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handlePayment}
            disabled={processing}
            className="flex-1 bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {useIap ? "Processing…" : "Redirecting…"}
              </>
            ) : (
              <>
                {useIap ? <Smartphone className="w-4 h-4 mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                {payLabel}
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">What you get:</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Store up to {newLimit} files (photos & videos combined)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>AI-powered search across all your media</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Unlimited searches and downloads</span>
            </li>
          </ul>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
          {useIap ? (
            <>
              <Smartphone className="w-3 h-3" />
              <span>Secure Apple In-App Purchase (required for App Store)</span>
            </>
          ) : (
            <>
              <CreditCard className="w-3 h-3" />
              <span>Secure Stripe payment processing</span>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
