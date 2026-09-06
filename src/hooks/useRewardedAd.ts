import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

// Google's public test units, which serve real video ads without an AdMob account. Replacing
// these with live ids is the only change needed once AdMob exists; everything else here is
// already the production path.
//
// Serving live ads from a debug build is a policy violation that can get an AdMob account
// banned, so test ids are forced in development regardless of what is configured.
const LIVE_UNITS = {
  streakReclaim: TestIds.REWARDED,
  trialExtension: TestIds.REWARDED,
  coinReward: TestIds.REWARDED,
};

export const AD_UNITS = __DEV__
  ? { streakReclaim: TestIds.REWARDED, trialExtension: TestIds.REWARDED, coinReward: TestIds.REWARDED }
  : LIVE_UNITS;

export const ADS_AVAILABLE = Platform.OS === 'android';

export const useRewardedAd = () => {
  const [showing, setShowing] = useState(false);

  const show = useCallback(async (unitId: string): Promise<AdResult> => {
    if (!ADS_AVAILABLE) return 'unavailable';

    setShowing(true);

    return new Promise<AdResult>((resolve) => {
      const ad = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });

      let earned = false;
      let settled = false;

      // Every path has to release the listeners and settle exactly once, or a dismissed ad
      // leaves the caller waiting forever behind a spinner.
      const finish = (result: AdResult) => {
        if (settled) return;
        settled = true;
        unsubLoaded();
        unsubEarned();
        unsubClosed();
        unsubError();
        setShowing(false);
        resolve(result);
      };

      const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        try {
          ad.show();
        } catch {
          finish('unavailable');
        }
      });

      const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });

      // Closing is the only reliable signal that the ad is done. The reward flag decides
      // whether they actually watched it or skipped out early.
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        finish(earned ? 'rewarded' : 'dismissed');
      });

      const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
        finish('unavailable');
      });

      try {
        ad.load();
      } catch {
        finish('unavailable');
      }
    });
  }, []);

  return { show, showing };
};
