const env = process.env;

export const config = {
  supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  maptilerKey: env.EXPO_PUBLIC_MAPTILER_KEY ?? '',
  rcIosKey: env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '',
  rcAndroidKey: env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '',
  privacyUrl: env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  termsUrl: env.EXPO_PUBLIC_TERMS_URL ?? '',
  supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',
  userAgent: 'CreekFinder/1.0 (mobile app)',
};

export const hasBackend = !!(config.supabaseUrl && config.supabaseAnonKey);
export const hasMapTiler = !!config.maptilerKey;

export const FREE_PLACE_LIMIT = 25;
export const FREE_ADVENTURE_LIMIT = 10;
export const FREE_PHOTOS_PER_PLACE = 5;
export const PREMIUM_PHOTOS_PER_PLACE = 30;
