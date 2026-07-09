import { useEffect } from 'react';
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DIFFICULTY_WINDOW_SECONDS, DEFAULT_DIFFICULTY, DifficultyLevel } from '../constants/difficulty';

const { UsageMonitor } = NativeModules;

export const useAppMonitor = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    startMonitoringFromStorage();
    return () => {
      UsageMonitor?.stopMonitoring();
    };
  }, []);
};

const startMonitoringFromStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding');
    if (!raw) return;
    const data = JSON.parse(raw);
    const apps: string[] = data.targetApps ?? [];
    const difficulty: DifficultyLevel = data.difficultyLevel ?? DEFAULT_DIFFICULTY;
    const windowSeconds = DIFFICULTY_WINDOW_SECONDS[difficulty] ?? DIFFICULTY_WINDOW_SECONDS[DEFAULT_DIFFICULTY];
    if (apps.length > 0 && UsageMonitor) {
      UsageMonitor.startMonitoring(apps, windowSeconds);
    }
  } catch {}
};
