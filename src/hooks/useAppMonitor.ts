import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT } from '../constants/dailyLimit';

const { UsageMonitor } = NativeModules;

// Restart whenever the signed-in account changes or onboarding completes — otherwise the
// native monitor keeps running with whichever account's app list was active when it first
// started, and never picks up a freshly-onboarded account's real selections at all.
export const useAppMonitor = (uid?: string, isOnboarded?: boolean) => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    startMonitoringFromStorage();
    return () => {
      UsageMonitor?.stopMonitoring();
    };
  }, [uid, isOnboarded]);
};

const startMonitoringFromStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding');
    if (!raw) return;
    const data = JSON.parse(raw);
    const apps: string[] = data.targetApps ?? [];
    const difficulty: DifficultyLevel = data.difficultyLevel ?? DEFAULT_DIFFICULTY;
    const windowSeconds = DIFFICULTY_WINDOW_SECONDS[difficulty] ?? DIFFICULTY_WINDOW_SECONDS[DEFAULT_DIFFICULTY];
    const dailyLimit: number = data.dailyChallengeLimit ?? DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT];
    if (apps.length > 0 && UsageMonitor) {
      UsageMonitor.startMonitoring(apps, windowSeconds, dailyLimit);
    }
  } catch {}
};
