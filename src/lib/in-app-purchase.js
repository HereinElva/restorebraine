import { Capacitor } from '@capacitor/core';
import { IAP_STORAGE_PRODUCT_ID } from '@/lib/storage-billing';

let billingReady = false;
let cachedProduct = null;

export async function isInAppPurchaseAvailable() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return false;
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    return isBillingSupported;
  } catch {
    return false;
  }
}

export async function loadStorageProduct() {
  if (cachedProduct) return cachedProduct;
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [IAP_STORAGE_PRODUCT_ID],
    productType: PURCHASE_TYPE.INAPP,
  });
  cachedProduct = products?.[0] || null;
  return cachedProduct;
}

export async function initializeInAppPurchases() {
  if (billingReady || !(await isInAppPurchaseAvailable())) return false;
  await loadStorageProduct();
  billingReady = true;
  return true;
}

/**
 * Purchase storage tier(s) via Apple In-App Purchase (consumable).
 * @param {number} quantity - Number of 250-media blocks to buy
 * @param {string} [appAccountToken] - Optional UUID linking purchase to user
 */
export async function purchaseStorageTiers(quantity = 1, appAccountToken) {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  if (!isBillingSupported) {
    throw new Error('In-app purchases are not available on this device.');
  }

  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: IAP_STORAGE_PRODUCT_ID,
    productType: PURCHASE_TYPE.INAPP,
    quantity: Math.max(1, quantity),
    appAccountToken,
  });

  return {
    transactionId: transaction.transactionId,
    productIdentifier: transaction.productIdentifier,
    receipt: transaction.receipt,
    jwsRepresentation: transaction.jwsRepresentation,
    purchaseToken: transaction.purchaseToken,
  };
}
