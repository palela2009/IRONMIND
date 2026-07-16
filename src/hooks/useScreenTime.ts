import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform, AppState } from 'react-native';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';

const { UsageMonitor } = NativeModules;

const BASE_URL = API_BASE_URL;

export interface AppUsage {
  app: string;
  minutes: number;
}

const getTodayDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const saveToBackend = async (apps: AppUsage[]) => {
  try {
    await authedFetch(`${BASE_URL}/api/screentime`, {
      method: 'POST',
      body: JSON.stringify({ date: getTodayDate(), apps }),
    });
  } catch {}
};

export const useScreenTime = (userId?: string) => {
  const [screenTime, setScreenTime] = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchStats = useCallback(async () => {
    if (Platform.OS !== 'android' || !UsageMonitor) {
      setLoading(false);
      return;
    }
    try {
      const raw: AppUsage[] = await UsageMonitor.getUsageStats();
      const top10 = raw
        .filter((a) => a.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 10);
      setScreenTime(top10);

      if (userId && top10.length > 0) {
        saveToBackend(top10);
      }
    } catch {
      setScreenTime([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchStats();
    });
    return () => sub.remove();
  }, [fetchStats]);

  return { screenTime, loading, refetch: fetchStats };
};

export const formatMinutes = (minutes: number): string => {
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};
