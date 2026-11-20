import { useCallback, useEffect, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appAlert } from '../components/AppDialog';
import { auth } from '../config/firebase';

type ReelsSettings = { consented: boolean; enabled: boolean };
const monitor = Platform.OS === 'android' ? NativeModules.UsageMonitor : null;

export function useInstagramReelsTest(uid: string | undefined, showDuringSetup: boolean) {
  const [loaded, setLoaded] = useState<{ uid: string; settings: ReelsSettings | null } | null>(null);
  const settings = loaded?.uid === uid ? loaded?.settings ?? null : null;
  const needsConsent = settings !== null && !settings.consented;

  const refresh = useCallback(async () => {
    if (!uid || !monitor?.getInstagramReelsTest) return;
    try {
      const result: ReelsSettings | null = await monitor.getInstagramReelsTest(uid);
      if (auth.currentUser?.uid === uid) setLoaded({ uid, settings: result });
    } catch {}
  }, [uid]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const openSettings = useCallback(async () => {
    if (!uid || auth.currentUser?.uid !== uid) return;
    try {
      if (!await monitor.openInstagramReelsTestSettings(uid)) throw new Error();
    } catch {
      appAlert('Could not open Accessibility settings', 'Try again from the Instagram Reels test setting.');
    }
  }, [uid]);

  const showDisclosure = useCallback(() => {
    if (!uid) return;
    const markSeen = () => void AsyncStorage.setItem(`@ironmind_reels_disclosure:${uid}`, 'seen').catch(() => {});
    appAlert(
      'Try Instagram Reels challenges',
      'IRONMIND uses Android Accessibility to recognize Instagram screens and detect Reels swipes. Screen identifiers and swipe activity stay on this device. IRONMIND does not read messages or take screenshots. Challenge results sync with your IRONMIND account.\n\nThis is optional. You can turn it off in your profile.',
      [
        {
          text: 'Agree and open Settings',
          onPress: () => {
            markSeen();
            if (auth.currentUser?.uid !== uid) return;
            void (async () => {
              try {
                if (!await monitor.setInstagramReelsTestConsent(uid, true)) throw new Error();
                await refresh();
                await openSettings();
              } catch {
                appAlert('Could not save your choice', 'Please try again.');
              }
            })();
          },
        },
        { text: 'Not now', style: 'cancel', onPress: markSeen },
      ],
    );
  }, [openSettings, refresh, uid]);

  useEffect(() => {
    if (!uid || !showDuringSetup || !needsConsent) return;
    let active = true;
    void AsyncStorage.getItem(`@ironmind_reels_disclosure:${uid}`).then((seen) => {
      if (active && !seen) showDisclosure();
    }).catch(() => {});
    return () => { active = false; };
  }, [uid, showDuringSetup, needsConsent, showDisclosure]);

  const open = () => {
    if (!uid || !settings) return;
    if (!settings.consented) {
      showDisclosure();
    } else if (!settings.enabled) {
      void openSettings();
    } else {
      appAlert('Instagram Reels test is on', 'You can stop Reels challenges whenever you want.', [
        { text: 'Keep on', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () => {
            if (auth.currentUser?.uid !== uid) return;
            void monitor.setInstagramReelsTestConsent(uid, false).then((saved: boolean) => {
              if (!saved) throw new Error();
              return refresh();
            }).catch(() => appAlert('Could not turn off Reels challenges', 'Please try again.'));
          },
        },
      ]);
    }
  };

  return settings ? {
    open,
    status: settings.consented ? settings.enabled ? 'ON' : 'FINISH SETUP' : 'OFF',
  } : null;
}
