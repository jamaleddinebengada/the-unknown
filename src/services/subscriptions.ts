import { Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

/**
 * UNKNOWN PLUS subscriptions via RevenueCat (Google Play Billing / App Store).
 * - Public SDK keys only (safe in the app). Entitlement id: "plus".
 * - The app user id is the anonymous Supabase user id, so the RevenueCat webhook
 *   (supabase/functions/revenuecat-webhook) can flip profiles.is_premium on the server.
 * - Premium status is never trusted from the client: limits are enforced in the database.
 */
/** Advertised list price; the store's localized price is always shown when available. */
export const PLUS_LIST_PRICE = '$20';
export const ENTITLEMENT = 'plus';
const KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  default: undefined,
}) ?? '';

export const subscriptionsAvailable = Platform.OS !== 'web' && KEY.length > 10;

let configuredFor: string | null = null;

export async function initPurchases(userId: string) {
  if (!subscriptionsAvailable) return;
  if (!configuredFor) {
    Purchases.configure({ apiKey: KEY, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn(userId);
    configuredFor = userId;
  }
}

export interface PlusPlan {
  id: string;
  kind: 'annual' | 'monthly' | 'other';
  title: string;
  price: string;
  perMonth: string | null;
  trial: string | null;
  pkg: PurchasesPackage;
}

export async function getPlusPlans(): Promise<PlusPlan[]> {
  if (!subscriptionsAvailable) return [];
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs
    .map((pkg): PlusPlan => {
      const kind = pkg.packageType === PACKAGE_TYPE.ANNUAL ? 'annual' : pkg.packageType === PACKAGE_TYPE.MONTHLY ? 'monthly' : 'other';
      const p = pkg.product;
      const perMonth = kind === 'annual' && p.price > 0 ? `${(p.price / 12).toFixed(2)} ${p.currencyCode}` : null;
      return {
        id: pkg.identifier, kind, pkg,
        title: kind === 'annual' ? 'Annual' : kind === 'monthly' ? 'Monthly' : p.title,
        price: p.priceString,
        perMonth,
        trial: p.introPrice && p.introPrice.price === 0 ? `${p.introPrice.periodNumberOfUnits} ${p.introPrice.periodUnit.toLowerCase()} free` : null,
      };
    })
    // THE UNKNOWN sells one plan: UNKNOWN PLUS monthly (set to $20/month in Google Play).
    .filter((p) => p.kind === 'monthly');
}

export const hasPlus = (info: CustomerInfo | null | undefined) => !!info?.entitlements.active[ENTITLEMENT];

/** Returns true when the purchase completed, false when the user cancelled. */
export async function buyPlan(plan: PlusPlan): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg);
    return hasPlus(customerInfo);
  } catch (e) {
    const err = e as { userCancelled?: boolean; code?: string };
    if (err.userCancelled || err.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
    throw e;
  }
}

export async function restorePlus(): Promise<boolean> {
  if (!subscriptionsAvailable) return false;
  return hasPlus(await Purchases.restorePurchases());
}

export async function manageSubscription() {
  if (subscriptionsAvailable) await Purchases.showManageSubscriptions();
}
