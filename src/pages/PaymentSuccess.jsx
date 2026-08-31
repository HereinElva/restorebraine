import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function PaymentSuccess() {
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const updatePaidTier = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
          // Verify payment and update paid tier
          const response = await base44.functions.invoke('verifyPayment', { sessionId });
          if (response.data.success) {
            await queryClient.invalidateQueries({ queryKey: ['current-user'] });
            setLoading(false);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setLoading(false);
      }
    };

    updatePaidTier();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Verifying payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Payment Successful!
        </h1>
        
        <p className="text-gray-600 mb-8">
          Your storage has been upgraded. You can now continue uploading your photos and videos.
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => navigate(createPageUrl("Upload"))}
            className="w-full bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white"
          >
            Continue Uploading
          </Button>
          
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Gallery"))}
            className="w-full"
          >
            Go to Gallery
          </Button>
        </div>
      </div>
    </div>
  );
}