import { useState } from 'react';

export type AdResult = 'rewarded' | 'dismissed' | 'unavailable';

export const AD_UNITS = {
  streakReclaim: 'ca-app-pub-3940256099942544/5224354917',
  trialExtension: 'ca-app-pub-3940256099942544/5224354917',
  themeUnlock: 'ca-app-pub-3940256099942544/5224354917',
};

export const AD_SDK_INSTALLED = false;

export const useRewardedAd = () => {
  const [showing, setShowing] = useState(false);

  const show = async (_unit: string): Promise<AdResult> => {
    if (!AD_SDK_INSTALLED) {
      setShowing(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setShowing(false);
      return 'rewarded';
    }
    return 'unavailable';
  };

  return { show, showing };
};
