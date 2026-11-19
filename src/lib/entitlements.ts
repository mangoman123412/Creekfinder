import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage, type CustomerInfo } from 'react-native-purchases';
import { config } from '../config';

export const ENTITLEMENT_ID = 'premium';
const key = Platform.OS === 'ios' ? config.rcIosKey : config.rcAndroidKey;
export const billingConfigured = !!key;

let configured = false;
export function initBilling(userId: string | null) {
  if (!billingConfigured) return;
  if (!configured) { Purchases.configure({ apiKey: key, appUserID: userId ?? undefined }); configured = true; }
}
export async function billingLogin(userId: string | null) {
  if (!billingConfigured) return;
  initBilling(userId);
  try { if (userId) await Purchases.logIn(userId); else await Purchases.logOut(); } catch {}
}
export const hasPremium = (info: CustomerInfo) => !!info.entitlements.active[ENTITLEMENT_ID];

export async function currentPremium(): Promise<boolean> {
  if (!billingConfigured) return false;
  initBilling(null);
  try { return hasPremium(await Purchases.getCustomerInfo()); } catch { return false; }
}
export function onPremiumChange(cb: (p: boolean) => void): () => void {
  if (!billingConfigured) return () => {};
  initBilling(null);
  const l = (info: CustomerInfo) => cb(hasPremium(info));
  Purchases.addCustomerInfoUpdateListener(l);
  return () => { Purchases.removeCustomerInfoUpdateListener(l); };
}
export async function getPackages(): Promise<PurchasesPackage[]> {
  if (!billingConfigured) return [];
  initBilling(null);
  const o = await Purchases.getOfferings();
  return o.current?.availablePackages ?? [];
}
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
  const r = await Purchases.purchasePackage(pkg);
  return hasPremium(r.customerInfo);
}
export async function restore(): Promise<boolean> {
  initBilling(null);
  return hasPremium(await Purchases.restorePurchases());
}
