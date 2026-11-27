import { useCallback, useEffect, useState } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import { appAlert } from '../components/AppDialog';
import { auth } from '../config/firebase';

export type ReelsSettings = {
  consented: boolean;
  enabled: boolean;
  expandedConsented: boolean;
  connected?: boolean;
  countToday?: number;
  maxPerDay?: number;
  cooldownRemainingMs?: number;
};

export type ShortVideoController = {
  open: () => void;
  openGuide: () => void;
  closeGuide: () => void;
  acceptAndOpenSettings: () => Promise<void>;
  openSettingsOnly: () => Promise<void>;
  turnOff: () => Promise<void>;
  refresh: () => Promise<void>;
  guideVisible: boolean;
  status: 'ON' | 'RECONNECT' | 'FINISH SETUP' | 'INSTAGRAM ONLY' | 'OFF';
  isActive: boolean;
  needsSetup: boolean;
  needsReconnect: boolean;
  connected: boolean;
  countToday: number;
  maxPerDay: number;
  cooldownRemainingMs: number;
  settings: ReelsSettings;
};

const monitor = Platform.OS === 'android' ? NativeModules.UsageMonitor : null;

export function useInstagramReelsTest(uid: string | undefined, _showDuringSetup = false): ShortVideoController | null {
  const [loaded, setLoaded] = useState<{ uid: string; settings: ReelsSettings | null } | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);
  const [reconnectGraceDone, setReconnectGraceDone] = useState(false);
  const settings = loaded?.uid === uid ? loaded?.settings ?? null : null;

  const refresh = useCallback(async () => {
    if (!uid || !monitor?.getInstagramReelsTest) return;
    try {
      const result: ReelsSettings | null = await monitor.getInstagramReelsTest(uid);
      if (auth.currentUser?.uid === uid) setLoaded({ uid, settings: result });
    } catch {}
  }, [uid]);

  useEffect(() => {
    setGuideVisible(false);
    setReconnectGraceDone(false);
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setReconnectGraceDone(false);
        void refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!settings?.enabled || settings.connected !== false) {
      setReconnectGraceDone(false);
      return;
    }
    const timer = setTimeout(() => {
      void refresh().finally(() => setReconnectGraceDone(true));
    }, 1500);
    return () => clearTimeout(timer);
  }, [refresh, settings?.connected, settings?.enabled]);

  const openSettingsOnly = useCallback(async () => {
    if (!uid || auth.currentUser?.uid !== uid || !monitor?.openInstagramReelsTestSettings) return;
    try {
      if (!(await monitor.openInstagramReelsTestSettings(uid))) throw new Error();
    } catch {
      appAlert('Could not open Accessibility settings', 'Open Android Settings → Accessibility → Installed/Downloaded apps → IRONMIND — Scroll Detection.');
    }
  }, [uid]);

  const acceptAndOpenSettings = useCallback(async () => {
    if (!uid || auth.currentUser?.uid !== uid || !monitor?.setShortVideoTestConsent) return;
    try {
      if (!(await monitor.setShortVideoTestConsent(uid, true))) throw new Error();
      await refresh();
      if (!settings?.enabled) {
        await openSettingsOnly();
      } else {
        setGuideVisible(false);
      }
    } catch {
      appAlert('Could not save your choice', 'Please try again.');
    }
  }, [openSettingsOnly, refresh, settings?.enabled, uid]);

  const turnOff = useCallback(async () => {
    if (!uid || auth.currentUser?.uid !== uid || !monitor?.setShortVideoTestConsent) return;
    try {
      if (!(await monitor.setShortVideoTestConsent(uid, false))) throw new Error();
      setGuideVisible(false);
      await refresh();
    } catch {
      appAlert('Could not turn off scroll detection', 'Please try again.');
    }
  }, [refresh, uid]);

  const openGuide = useCallback(() => {
    if (!uid || !settings) return;
    setGuideVisible(true);
  }, [uid, settings]);

  const closeGuide = useCallback(() => setGuideVisible(false), []);

  const open = useCallback(() => {
    if (!uid || !settings) return;
    const isConnected = settings.connected ?? settings.enabled;
    const staleDisconnected = settings.enabled && !isConnected && reconnectGraceDone;
    if (settings.consented && settings.expandedConsented && settings.enabled && !staleDisconnected) {
      appAlert(
        'Scroll Challenges are active',
        'Challenges fire ONLY when you actively scroll Instagram Reels, TikTok, YouTube Shorts, Facebook Reels, or Snapchat Spotlight — never during DMs, Snaps, studying on YouTube, or watching 1 shared video.',
        [
          { text: 'Keep on', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void openSettingsOnly() },
          { text: 'Turn off', style: 'destructive', onPress: () => void turnOff() },
        ]
      );
      return;
    }
    setGuideVisible(true);
  }, [openSettingsOnly, reconnectGraceDone, settings, turnOff, uid]);

  if (!settings) return null;

  const connected = Boolean(settings.connected ?? settings.enabled);
  const needsReconnect = settings.consented && settings.expandedConsented && settings.enabled && !connected && reconnectGraceDone;
  const isActive = settings.consented && settings.expandedConsented && settings.enabled && !needsReconnect;

  const status: ShortVideoController['status'] = needsReconnect
    ? 'RECONNECT'
    : settings.consented
    ? settings.enabled
      ? settings.expandedConsented
        ? 'ON'
        : 'INSTAGRAM ONLY'
      : 'FINISH SETUP'
    : 'OFF';

  return {
    open,
    openGuide,
    closeGuide,
    acceptAndOpenSettings,
    openSettingsOnly,
    turnOff,
    refresh,
    guideVisible,
    status,
    isActive,
    needsSetup: settings.consented && !isActive,
    needsReconnect,
    connected,
    countToday: Number(settings.countToday ?? 0),
    maxPerDay: Number(settings.maxPerDay ?? 5),
    cooldownRemainingMs: Number(settings.cooldownRemainingMs ?? 0),
    settings,
  };
}
