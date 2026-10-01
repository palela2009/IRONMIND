import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

const LIVE_UNITS = {
  streakReclaim: TestIds.REWARDED,
  trialExtension: TestIds.REWARDED,
  coinReward: TestIds.REWARDED,
};

export const AD_UNITS = __DEV__
  ? { streakReclaim: TestIds.REWARDED, trialExtension: TestIds.REWARDED, coinReward: TestIds.REWARDED }
  : LIVE_UNITS;

const ADS_ENABLED = false;

export const ADS_AVAILABLE = ADS_ENABLED && Platform.OS === 'android';

export const useRewardedAd = () => {
  const [showing, setShowing] = useState(false);

  const show = useCallback(async (unitId: string): Promise<AdResult> => {
    if (!ADS_AVAILABLE) return 'unavailable';

    setShowing(true);

    return new Promise<AdResult>((resolve) => {
      const ad = RewardedAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });

      let earned = false;
      let settled = false;

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
