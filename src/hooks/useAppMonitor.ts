import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT } from '../constants/dailyLimit';

const { UsageMonitor } = NativeModules;

export const useAppMonitor = (uid?: string) => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    syncAppMonitor();
    return () => {
      UsageMonitor?.stopMonitoring();
    };
  }, [uid]);
};

export const syncAppMonitor = async () => {
  if (Platform.OS !== 'android') return;
  await startMonitoringFromStorage();
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
