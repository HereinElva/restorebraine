import React, { useState } from "react";
import { X, CreditCard, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

export default function PaymentModal({ photosUploaded, onClose, currentPaidTier = 0 }) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const newTier = Math.floor(photosUploaded / 250);
  const tiersPassed = newTier - currentPaidTier;
  const amountDue = tiersPassed * 0.50;
  const nextLimit = tiersPassed * 250;

  const handlePayment = async () => {
    setError(null);
    setProcessing(true);

    try {
      const response = await base44.functions.invoke('createCheckout', {
        amount: amountDue,
        tiersPassed
      });

      if (response.data.url) {
        // Redirect to Stripe checkout
        window.location.href = response.data.url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
      setProcessing(false);
    }
  };

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
              <CreditCard className="w-6 h-6 text-purple-600" />
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
            You've uploaded <span className="font-semibold text-purple-600">{photosUploaded}</span> files! 
          </p>
          <p className="text-gray-600">
            To continue uploading, please make a payment of <span className="font-bold text-gray-900">${amountDue.toFixed(2)}</span> for your next 250 files.
          </p>
        </div>

        {/* Pricing Breakdown */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-100 rounded-2xl p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Pricing</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">First 250 files (photos & videos)</span>
              <span className="text-gray-900 font-medium">Free</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Every 250 files after</span>
              <span className="text-gray-900 font-medium">$0.50</span>
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

        {/* Payment Button */}
        <div className="flex gap-3 mb-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={processing}
            className="flex-1"
          >
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
                Redirecting...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay ${amountDue.toFixed(2)}
              </>
            )}
          </Button>
        </div>

        {/* What You Get */}
        <div className="pt-4 border-t border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 text-sm">What you get:</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>Store up to {nextLimit + 250} files (photos & videos combined)</span>
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
          <CreditCard className="w-3 h-3" />
          <span>Secure Stripe payment processing</span>
        </div>
      </Card>
    </div>
  );
}