import { useEffect } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT } from '../constants/dailyLimit';
import { refreshScreenTime } from './useScreenTime';
import { deviceTimeZone } from '../utils/challengeTime';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';

const { UsageMonitor } = NativeModules;

const GOAL_COPY: Record<string, string> = {
  doomscroll: 'Kill the autopilot scroll loop',
  focus: 'Protect your study & work focus',
  morning: 'Start your mornings clean',
  habit: 'Rewire automatic checking',
  sleep: 'Protect your sleep tonight',
  time: 'Reclaim your free time',
};

let currentUid = '';
let syncTokenInFlight: Promise<void> | null = null;

const syncTokenKey = (uid: string) => `@ironmind_sync_token:${uid}`;

export const ensureBackgroundSync = (uid: string): Promise<void> => {
  if (Platform.OS !== 'android' || !uid || !UsageMonitor?.setBackgroundSyncConfig) {
    return Promise.resolve();
  }
  if (syncTokenInFlight) return syncTokenInFlight;
  const run = async () => {
    try {
      let token = await AsyncStorage.getItem(syncTokenKey(uid));
      if (!token) {
        const res = await authedFetch(`${API_BASE_URL}/api/user/sync-token`, { method: 'POST' }, uid);
        if (!res.ok) return;
        const body = await res.json().catch(() => ({}));
        if (typeof body.syncToken !== 'string' || !body.syncToken) return;
        const minted: string = body.syncToken;
        token = minted;
        await AsyncStorage.setItem(syncTokenKey(uid), minted);
      }
      if (token && currentUid === uid) {
        UsageMonitor.setBackgroundSyncConfig(API_BASE_URL, token);
      }
    } catch {}
  };
  syncTokenInFlight = run().finally(() => {
    syncTokenInFlight = null;
  });
  return syncTokenInFlight;
};

export const revokeBackgroundSync = async (uid?: string) => {
  try {
    if (Platform.OS === 'android') UsageMonitor?.clearSyncToken?.();
    if (uid) {
      await AsyncStorage.removeItem(syncTokenKey(uid)).catch(() => {});
      await authedFetch(`${API_BASE_URL}/api/user/sync-token`, { method: 'DELETE' }, uid).catch(() => {});
    }
  } catch {}
};

export const useAppMonitor = (uid?: string) => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    currentUid = uid ?? '';
    if (!uid) {
      UsageMonitor?.stopMonitoring();
      return;
    }
    void ensureBackgroundSync(uid);
    void syncAppMonitor();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void ensureBackgroundSync(uid);
        void syncAppMonitor();
      }
    });
    return () => {
      sub.remove();
      UsageMonitor?.stopMonitoring();
    };
  }, [uid]);
};

export const syncAppMonitor = async () => {
  if (Platform.OS !== 'android') return;
  if (!currentUid) return;
  await startMonitoringFromStorage();
  refreshScreenTime(false);
};

const startMonitoringFromStorage = async () => {
  try {
    const uid = currentUid;
    if (!uid || !(await UsageMonitor?.hasUsageAccess())) return;
    const raw = await AsyncStorage.getItem('@ironmind_onboarding');
    if (uid !== currentUid) return;
    if (!raw) return;
    const data = JSON.parse(raw);
    const apps: string[] = Array.isArray(data.targetApps) ? data.targetApps : [];
    const difficulty: DifficultyLevel = data.difficultyLevel ?? DEFAULT_DIFFICULTY;
    const windowSeconds = DIFFICULTY_WINDOW_SECONDS[difficulty] ?? DIFFICULTY_WINDOW_SECONDS[DEFAULT_DIFFICULTY];
    const dailyLimit: number = data.dailyChallengeLimit ?? DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT];
    const limits: Record<string, number> = {};
    for (const entry of data.appLimits ?? []) {
      if (entry?.app && Number(entry.minutes) > 0) limits[entry.app] = Math.round(entry.minutes);
    }

    const goalId = Array.isArray(data.goals) && data.goals[0] ? String(data.goals[0]) : '';
    const goalText = GOAL_COPY[goalId] ?? goalId;
    UsageMonitor?.setUserGoal?.(goalText);

    if (apps.length === 0) {
      UsageMonitor?.stopMonitoring?.();
      return;
    }

    if (UsageMonitor) {
      UsageMonitor.setChallengeTimeZone?.(data.timeZone ?? deviceTimeZone());
      UsageMonitor.startMonitoring(apps, windowSeconds, dailyLimit, uid, JSON.stringify(limits));
      void ensureBackgroundSync(uid);
    }
  } catch {}
};
