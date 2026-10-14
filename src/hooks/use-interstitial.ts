// Preloads an interstitial (full-screen) ad and returns a `show` function.
// Safe to call anywhere: when ads aren't supported it simply does nothing.
// The ad only shows if it finished loading, and a fresh one is preloaded after
// each close so the next show is ready.
import { useCallback, useEffect, useRef } from 'react';

import { adsSupported, getAdsModule, getInterstitialUnitId } from '../utils/ads';

export function useInterstitial(): () => void {
  const adRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!adsSupported) return;

    const mod = getAdsModule();
    const unitId = getInterstitialUnitId();
    if (!mod || !unitId) return;

    const { InterstitialAd, AdEventType } = mod;
    const ad = InterstitialAd.createForAdRequest(unitId);
    adRef.current = ad;

    const unsubscribers = [
      ad.addAdEventListener(AdEventType.LOADED, () => {
        loadedRef.current = true;
      }),
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        loadedRef.current = false;
        ad.load(); // Preload the next one on the same instance.
      }),
      ad.addAdEventListener(AdEventType.ERROR, (error: unknown) => {
        loadedRef.current = false;
        console.warn('Interstitial error', error);
      }),
    ];

    ad.load();

    return () => unsubscribers.forEach((unsubscribe: () => void) => unsubscribe());
  }, []);

  return useCallback(() => {
    if (loadedRef.current && adRef.current) {
      adRef.current.show().catch(() => {});
    }
  }, []);
}
