const CONSENT_KEY = 'restorebraine_ai_upload_consent_v1';

export function hasAiUploadConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function grantAiUploadConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function revokeAiUploadConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* ignore */
  }
}
