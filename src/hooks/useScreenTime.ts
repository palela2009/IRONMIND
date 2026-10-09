import { useState, useEffect } from 'react';
import { NativeModules, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';

const { UsageMonitor } = NativeModules;

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface AppUsage {
  app: string;
  minutes: number;
}

export interface ScreenTimeDay {
  date: string;
  apps: AppUsage[];
}

export const todayKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface Store {
  today: AppUsage[];
  tracked: string[];
  week: ScreenTimeDay[];
  loading: boolean;
}

let store: Store = { today: [], tracked: [], week: [], loading: true };
const listeners = new Set<(s: Store) => void>();

const publish = (next: Partial<Store>) => {
  store = { ...store, ...next };
  listeners.forEach((l) => l(store));
};

const loadTracked = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding');
    return raw ? JSON.parse(raw).targetApps ?? [] : [];
  } catch {
    return [];
  }
};

const loadWeek = async () => {
  try {
    const res = await authedFetch(`${API_BASE_URL}/api/screentime/history?days=7`);
    if (!res.ok) return;
    const rows: { date: string; apps: AppUsage[] }[] = await res.json();
    publish({ week: rows.map((r) => ({ date: r.date, apps: r.apps })) });
  } catch {}
};

export const refreshScreenTime = async (upload = true) => {
  const tracked = await loadTracked();
  publish({ tracked });
  if (Platform.OS !== 'android' || !UsageMonitor?.getUsageStats) {
    publish({ loading: false });
    return;
  }
  try {
    const raw: AppUsage[] = await UsageMonitor.getUsageStats();
    const apps = raw.filter((a) => a.minutes > 0).sort((a, b) => b.minutes - a.minutes).slice(0, 25);
    publish({ today: apps, loading: false });
    if (upload && apps.length > 0) {
      await authedFetch(`${API_BASE_URL}/api/screentime`, {
        method: 'POST',
        body: JSON.stringify({ date: todayKey(), apps }),
      }).catch(() => {});
    }
  } catch {
    publish({ loading: false });
  }
  loadWeek();
};

export const useScreenTimeSync = (uid?: string) => {
  useEffect(() => {
    if (!uid) return;
    refreshScreenTime();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refreshScreenTime();
    }, SYNC_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshScreenTime();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [uid]);
};

export const trackedTotal = (apps: AppUsage[], tracked: string[]): number =>
  apps.filter((a) => tracked.includes(a.app)).reduce((sum, a) => sum + a.minutes, 0);

export const useScreenTime = () => {
  const [state, setState] = useState<Store>(store);
  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);
  return {
    screenTime: state.today,
    tracked: state.tracked,
    week: state.week,
    loading: state.loading,
    trackedToday: trackedTotal(state.today, state.tracked),
    refetch: refreshScreenTime,
  };
};

export const formatMinutes = (minutes: number): string => {
  if (minutes < 1) return '<1m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};
