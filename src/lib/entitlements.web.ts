/** Web build: no app-store billing. Premium comes from the server flag or the UNLOCK_ALL setting. */
export const ENTITLEMENT_ID = 'premium';
export const billingConfigured = false;
export function initBilling(_u: string | null) {}
export async function billingLogin(_u: string | null) {}
export async function currentPremium() { return false; }
export function onPremiumChange(_cb: (p: boolean) => void) { return () => {}; }
export async function getPackages(): Promise<any[]> { return []; }
export async function buy(_p: any): Promise<boolean> { return false; }
export async function restore(): Promise<boolean> { return false; }
