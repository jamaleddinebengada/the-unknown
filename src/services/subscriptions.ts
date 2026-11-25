import { Platform } from 'react-native';
import Purchases, { PACKAGE_TYPE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

/**
 * THE UNKNOWN memberships via RevenueCat (Google Play Billing / App Store In-App Purchase).
 *
 *   FREE · UNKNOWN VIP (entitlement "plus") · UNKNOWN SUPER VIP (entitlement "vip"), monthly + annual.
 *   Suggested store prices: VIP $9.99/mo, $59.99/yr · SUPER VIP $19.99/mo, $119.99/yr — set them in Google Play;
 *   the app only ever shows the localized price returned by the billing SDK.
 *
 * Store setup (see README): products plus_monthly, plus_yearly, vip_monthly, vip_yearly;
 * RevenueCat entitlements "plus" (PLUS + VIP products) and "vip" (VIP products); one offering
 * whose packages are those four products.
 * - Only public SDK keys live in the app. The app user id is the anonymous Supabase user id.
 * - The tier is granted on the server by the RevenueCat webhook; every limit is enforced in
 *   the database, never trusted from the client.
 */
export type PaidTier = 'plus' | 'vip';
export type Billing = 'monthly' | 'yearly';

/** Shown before the store is connected: no invented prices — the real price comes from Google Play. */
export const LIST_PRICES: Record<PaidTier, Record<Billing, string>> = {
  plus: { monthly: 'In store', yearly: 'In store' },
  vip: { monthly: 'In store', yearly: 'In store' },
};
export const YEARLY_SAVING = '50%';

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

export interface StorePlan { tier: PaidTier; billing: Billing; price: string; perMonth: string | null; trial: string | null; productId: string; pkg: PurchasesPackage }

function classify(pkg: PurchasesPackage): { tier: PaidTier; billing: Billing } | null {
  const id = `${pkg.identifier} ${pkg.product.identifier}`.toLowerCase();
  const tier: PaidTier | null = id.includes('vip') ? 'vip' : id.includes('plus') ? 'plus' : null;
  if (!tier) return null;
  const yearly = pkg.packageType === PACKAGE_TYPE.ANNUAL || /year|annual/.test(id);
  return { tier, billing: yearly ? 'yearly' : 'monthly' };
}

export async function getStorePlans(): Promise<StorePlan[]> {
  if (!subscriptionsAvailable) return [];
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings.current?.availablePackages ?? [];
  return pkgs.flatMap((pkg) => {
    const c = classify(pkg);
    if (!c) return [];
    const p = pkg.product;
    return [{
      ...c, pkg, productId: p.identifier, price: p.priceString,
      perMonth: c.billing === 'yearly' && p.price > 0 ? `${(p.price / 12).toFixed(0)} ${p.currencyCode}` : null,
      trial: p.introPrice && p.introPrice.price === 0 ? `${p.introPrice.periodNumberOfUnits}-${p.introPrice.periodUnit.toLowerCase()} free trial` : null,
    }];
  });
}

export const tierOf = (info: CustomerInfo | null | undefined): 'free' | PaidTier =>
  info?.entitlements.active.vip ? 'vip' : info?.entitlements.active.plus ? 'plus' : 'free';

/** Buy, upgrade or downgrade. Returns false when the user cancels. */
export async function buyPlan(plan: StorePlan): Promise<boolean> {
  try {
    let googleProductChangeInfo: { oldProductIdentifier: string } | undefined;
    if (Platform.OS === 'android') {
      const info = await Purchases.getCustomerInfo();
      const current = info.activeSubscriptions.find((id) => id !== plan.productId);
      if (current) googleProductChangeInfo = { oldProductIdentifier: current.split(':')[0] };
    }
    const { customerInfo } = await Purchases.purchasePackage(plan.pkg, null, googleProductChangeInfo ?? null);
    return tierOf(customerInfo) !== 'free';
  } catch (e) {
    const err = e as { userCancelled?: boolean; code?: string };
    if (err.userCancelled || err.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<'free' | PaidTier> {
  if (!subscriptionsAvailable) return 'free';
  return tierOf(await Purchases.restorePurchases());
}

export async function manageSubscription() {
  if (subscriptionsAvailable) await Purchases.showManageSubscriptions();
}
