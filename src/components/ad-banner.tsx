// Anchored adaptive banner shown above the bottom navigation. Renders nothing
// when ads aren't supported (Expo Go, web) or haven't been configured.
import { View } from 'react-native';

import { adsSupported, getAdsModule, getBannerUnitId } from '../utils/ads';

export default function AdBanner() {
  if (!adsSupported) return null;

  const mod = getAdsModule();
  const unitId = getBannerUnitId();
  if (!mod || !unitId) return null;

  const { BannerAd, BannerAdSize } = mod;

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#000000' }}>
      <BannerAd unitId={unitId} size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
