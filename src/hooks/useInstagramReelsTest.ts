import { useCallback, useEffect, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appAlert } from '../components/AppDialog';
import { auth } from '../config/firebase';

type ReelsSettings = { consented: boolean; enabled: boolean; expandedConsented: boolean };
const monitor = Platform.OS === 'android' ? NativeModules.UsageMonitor : null;

export function useInstagramReelsTest(uid: string | undefined, showDuringSetup: boolean) {
  const [loaded, setLoaded] = useState<{ uid: string; settings: ReelsSettings | null } | null>(null);
  const settings = loaded?.uid === uid ? loaded?.settings ?? null : null;
  const needsConsent = settings !== null && !settings.expandedConsented;

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
      appAlert('Could not open Accessibility settings', 'Try again from the Short Video Test setting.');
    }
  }, [uid]);

  const showDisclosure = useCallback(() => {
    if (!uid) return;
    const markSeen = () => void AsyncStorage.setItem(`@ironmind_short_video_disclosure:${uid}`, 'seen').catch(() => {});
    appAlert(
      'Try short-video challenges',
      'IRONMIND uses Android Accessibility to recognize Instagram Reels, Facebook Reels, TikTok video feeds and YouTube Shorts in the apps you select for tracking. Screen identifiers, navigation labels and swipe activity stay on this device. IRONMIND does not read message text, captions or screenshots. Challenge results sync with your IRONMIND account.\n\nThis is optional. You can turn it off in your profile.',
      [
        {
          text: settings?.enabled ? 'Agree and turn on' : 'Agree and open Settings',
          onPress: () => {
            markSeen();
            if (auth.currentUser?.uid !== uid) return;
            void (async () => {
              try {
                if (!await monitor.setShortVideoTestConsent(uid, true)) throw new Error();
                await refresh();
                if (!settings?.enabled) await openSettings();
              } catch {
                appAlert('Could not save your choice', 'Please try again.');
              }
            })();
          },
        },
        { text: 'Not now', style: 'cancel', onPress: markSeen },
      ],
    );
  }, [openSettings, refresh, settings?.enabled, uid]);

  useEffect(() => {
    if (!uid || !showDuringSetup || !needsConsent) return;
    let active = true;
    void AsyncStorage.getItem(`@ironmind_short_video_disclosure:${uid}`).then((seen) => {
      if (active && !seen) showDisclosure();
    }).catch(() => {});
    return () => { active = false; };
  }, [uid, showDuringSetup, needsConsent, showDisclosure]);

  const open = () => {
    if (!uid || !settings) return;
    const turnOff = () => {
      if (auth.currentUser?.uid !== uid) return;
      void monitor.setShortVideoTestConsent(uid, false).then((saved: boolean) => {
        if (!saved) throw new Error();
        return refresh();
      }).catch(() => appAlert('Could not turn off short-video challenges', 'Please try again.'));
    };
    if (!settings.consented) {
      showDisclosure();
    } else if (!settings.expandedConsented) {
      appAlert('Instagram-only consent', 'Add Facebook Reels, TikTok and YouTube Shorts to the test, or turn off short-video challenges.', [
        { text: 'Add more apps', onPress: showDisclosure },
        { text: 'Turn off', style: 'destructive', onPress: turnOff },
        { text: 'Keep Instagram', style: 'cancel', onPress: () => { if (!settings.enabled) void openSettings(); } },
      ]);
    } else if (!settings.enabled) {
      void openSettings();
    } else {
      appAlert('Short Video Test is on', 'You can stop short-video challenges whenever you want.', [
        { text: 'Keep on', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: turnOff,
        },
      ]);
    }
  };

  return settings ? {
    open,
    status: settings.consented ? settings.enabled ? settings.expandedConsented ? 'ON' : 'INSTAGRAM ONLY' : 'FINISH SETUP' : 'OFF',
  } : null;
}
