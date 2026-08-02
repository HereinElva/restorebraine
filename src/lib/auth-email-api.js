import { appParams } from '@/lib/app-params';

/**
 * Email auth via fetch — avoids axios global Authorization headers that cause false "already exists".
 */
export async function postAuthEmail(path, body, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${appParams.serverUrl}/api/apps/${appParams.appId}/auth/${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-App-Id': appParams.appId,
        },
        credentials: 'omit',
        cache: 'no-store',
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const message = data.message || data.detail || `Unable to ${path}`;
      throw Object.assign(new Error(message), {
        status: response.status,
        data: { ...data, message },
      });
    }

    return data;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw Object.assign(new Error(`auth.${path} timed out`), { status: 408 });
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function verifyAuthOtp(email, otpCode, options) {
  return postAuthEmail(
    'verify-otp',
    { email, otp_code: String(otpCode || '').trim() },
    options,
  );
}

export async function resendAuthOtp(email, options) {
  return postAuthEmail('resend-otp', { email }, options);
}

export function extractAuthAccessToken(data) {
  if (!data) return null;
  return data.access_token || data.token || data.accessToken || null;
}

export function isOtpVerifiedResponse(data) {
  if (!data) return false;
  if (extractAuthAccessToken(data)) return true;
  return /verified|verification successful|email verified|successfully verified/i.test(data.message || '');
}

export function isVerificationRequiredResponse(data) {
  if (!data || data.access_token) return false;
  return Boolean(
    data.requires_verification
    || data.verification_required
    || data.otp_sent
    || data.requires_otp
    || /verification code|verify your email|code sent|check your email/i.test(data.message || ''),
  );
}

export function isVerificationPendingError(error) {
  const message = error?.data?.message || error?.message || '';
  return /verif|confirm|otp|not verified|pending|check your email/i.test(message);
}

export function verificationRequiredError(email, message = 'Check your email for a verification code to finish creating your account.') {
  return Object.assign(new Error(message), {
    code: 'VERIFICATION_REQUIRED',
    email,
    status: 202,
  });
}
