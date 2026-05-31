/** Storage billing: first 250 media free, then $0.50 per additional 250. */

export const MEDIA_PER_TIER = 250;
export const PRICE_PER_TIER_USD = 0.5;

/** App Store consumable product ID — only used if not on hosted web app. */
export const IAP_STORAGE_PRODUCT_ID = 'com.restorebraine.storage.250';

export function getStorageLimit(paidTier = 0) {
  return (Number(paidTier) + 1) * MEDIA_PER_TIER;
}

export function getTiersNeeded(currentCount, additionalCount, paidTier = 0) {
  const projected = Number(currentCount) + Number(additionalCount);
  const limit = getStorageLimit(paidTier);
  if (projected <= limit) return 0;
  return Math.ceil((projected - limit) / MEDIA_PER_TIER);
}

export function getAmountDue(tiersNeeded) {
  return tiersNeeded * PRICE_PER_TIER_USD;
}

export function wouldExceedStorageLimit(currentCount, additionalCount, paidTier = 0) {
  return getTiersNeeded(currentCount, additionalCount, paidTier) > 0;
}
