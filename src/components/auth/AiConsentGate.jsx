import React, { useState } from "react";
import AiUploadConsentModal from "@/components/upload/AiUploadConsentModal";
import {
  grantAiUploadConsent,
  hasAiUploadConsent,
} from "@/lib/ai-upload-consent";

/** Shows AI data-collection consent once after account creation / first login. */
export default function AiConsentGate({ children }) {
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && !hasAiUploadConsent();

  return (
    <>
      {children}
      <AiUploadConsentModal
        open={open}
        onAccept={() => {
          grantAiUploadConsent();
          setDismissed(true);
        }}
        onDecline={() => setDismissed(true)}
      />
    </>
  );
}
