import React from "react";
import { Sparkles, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPENAI_PRIVACY_URL = "https://openai.com/policies/privacy-policy/";

export default function AiUploadConsentModal({ open, onAccept, onDecline }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[min(85vh,560px)]">
        <div className="overflow-y-auto px-5 pt-5 pb-3 flex-1 min-h-0">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h2 id="ai-consent-title" className="text-lg font-bold text-gray-900 leading-snug">
                Before we analyze your photos
              </h2>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                When you upload, photos are sent to <strong>OpenAI</strong> for short descriptions and search tags, saved to your private account only.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-purple-50/80 px-3 py-3 text-sm text-gray-700 space-y-1.5 leading-relaxed">
            <p><strong>Sent:</strong> only the photo or video you upload.</p>
            <p><strong>Used for:</strong> AI search tags — not used to train OpenAI models.</p>
            <a
              href={OPENAI_PRIVACY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-purple-600 font-medium"
            >
              OpenAI Privacy Policy
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-gray-500 mt-3 leading-relaxed">
            <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
            Delete items anytime. Revoke consent in Account settings.
          </p>
        </div>

        <div className="px-5 pt-3 pb-5 border-t border-gray-100 bg-white flex-shrink-0 space-y-2">
          <Button
            type="button"
            onClick={onAccept}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold text-base"
          >
            Continue
          </Button>
          <button
            type="button"
            onClick={onDecline}
            className="w-full py-2 text-sm text-gray-500 font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
