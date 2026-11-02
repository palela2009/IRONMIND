import { useEffect } from 'react';
import { AppState, NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT } from '../constants/dailyLimit';
import { refreshScreenTime } from './useScreenTime';
import { deviceTimeZone } from '../utils/challengeTime';

const { UsageMonitor } = NativeModules;

export const useAppMonitor = (uid?: string) => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    currentUid = uid ?? '';
    if (!uid) { UsageMonitor?.stopMonitoring(); return; }
    void syncAppMonitor();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void syncAppMonitor(); });
    return () => {
      sub.remove();
      UsageMonitor?.stopMonitoring();
    };
  }, [uid]);
};

let currentUid = '';

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
    const apps: string[] = data.targetApps ?? [];
    const difficulty: DifficultyLevel = data.difficultyLevel ?? DEFAULT_DIFFICULTY;
    const windowSeconds = DIFFICULTY_WINDOW_SECONDS[difficulty] ?? DIFFICULTY_WINDOW_SECONDS[DEFAULT_DIFFICULTY];
    const dailyLimit: number = data.dailyChallengeLimit ?? DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT];
    const limits: Record<string, number> = {};
    for (const entry of data.appLimits ?? []) {
      if (entry?.app && Number(entry.minutes) > 0) limits[entry.app] = Math.round(entry.minutes);
    }

    if (apps.length > 0 && UsageMonitor) {
      UsageMonitor.setChallengeTimeZone?.(data.timeZone ?? deviceTimeZone());
      UsageMonitor.startMonitoring(apps, windowSeconds, dailyLimit, uid, JSON.stringify(limits));
    }
  } catch {}
};
