// Google AdMob integration (banner + interstitial).
//
// Ads need native code, so they do NOT work in Expo Go (which friends use to
// test) or on web. Every entry point here is guarded: when ads aren't
// supported the functions no-op and the components render nothing, so the app
// keeps working everywhere. The real ad code only loads in a development or
// store build.
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go reports the "storeClient" environment; ads can't run there.
export const adsSupported =
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// --- Ad unit IDs -----------------------------------------------------------
// While this is true we always serve Google's TEST ads. Clicking your own
// REAL ads is against AdMob policy and can get the account banned, so leave
// this on until the app is live, then set the real unit IDs below and flip it
// to false.
export const USE_TEST_ADS = true;

// TODO: paste the real AdMob ad unit IDs here (AdMob > Ad units), then set
// USE_TEST_ADS = false. Each platform has its own unit id.
const REAL_BANNER_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-0000000000000000/0000000000',
  android: 'ca-app-pub-0000000000000000/0000000000',
});
const REAL_INTERSTITIAL_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-0000000000000000/0000000000',
  android: 'ca-app-pub-0000000000000000/0000000000',
});

// The native module is required lazily so a plain `import` never crashes in
// Expo Go, where the module is absent.
let adsModule: any = null;
export function getAdsModule(): any {
  if (!adsSupported) return null;
  if (!adsModule) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load so Expo Go (no native module) never crashes
      adsModule = require('react-native-google-mobile-ads');
    } catch {
      adsModule = null;
    }
  }
  return adsModule;
}

export function getBannerUnitId(): string | null {
  const mod = getAdsModule();
  if (!mod) return null;
  return USE_TEST_ADS ? mod.TestIds.ADAPTIVE_BANNER : REAL_BANNER_UNIT_ID ?? null;
}

export function getInterstitialUnitId(): string | null {
  const mod = getAdsModule();
  if (!mod) return null;
  return USE_TEST_ADS ? mod.TestIds.INTERSTITIAL : REAL_INTERSTITIAL_UNIT_ID ?? null;
}

// --- Initialization --------------------------------------------------------
let initialized = false;

// Call once at app launch. On iOS it first asks for App Tracking Transparency
// permission, then sets a teen content rating and starts the SDK. Any failure
// is swallowed so ads can never break the app.
export async function initializeAds(): Promise<void> {
  const mod = getAdsModule();
  if (!mod || initialized) return;
  initialized = true;
  try {
    if (Platform.OS === 'ios') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy load, keeps this off the Expo Go / web path
        const { requestTrackingPermissionsAsync } = require('expo-tracking-transparency');
        await requestTrackingPermissionsAsync();
      } catch {
        // No ATT module / user dismissed — continue with non-personalized ads.
      }
    }
    const mobileAds = mod.default;
    await mobileAds().setRequestConfiguration({
      // PG = family-friendly only: no sexual, mature or suggestive ads.
      // (G < PG < T < MA; PG keeps revenue reasonable while blocking adult content.)
      maxAdContentRating: mod.MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
  } catch (e) {
    console.warn('Ads init failed', e);
  }
}
