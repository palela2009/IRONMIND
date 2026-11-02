import { useState, useEffect } from 'react';
import { NativeModules, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';
import { auth } from '../config/firebase';
import { authedFetch } from '../utils/authFetch';
import { totalUsageMinutes, trackedUsageMinutes } from '../utils/screenTime';

const { UsageMonitor } = NativeModules;
export interface AppUsage { app: string; minutes: number }
export interface ScreenTimeDay { date: string; apps: AppUsage[] }
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
interface Store { today: AppUsage[]; tracked: string[]; limits: Record<string, number>; week: ScreenTimeDay[]; loading: boolean; syncError: boolean }
const initial: Store = { today: [], tracked: [], limits: {}, week: [], loading: true, syncError: false };
let store: Store = initial;
const listeners = new Set<(state: Store) => void>();
const inFlight = new Map<string, Promise<void>>();
const publish = (next: Partial<Store>) => { store = { ...store, ...next }; listeners.forEach((listener) => listener(store)); };

export const refreshScreenTime = (upload = true): Promise<void> => {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.resolve();
  const existing = inFlight.get(uid);
  if (existing) return existing;
  const run = async () => {
    const current = () => auth.currentUser?.uid === uid;
    const key = `@ironmind_screentime:${uid}`;
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const settings = raw ? JSON.parse(raw) : {};
      if (!current()) return;
      publish({ tracked: settings.targetApps ?? [], limits: Object.fromEntries((settings.appLimits ?? []).map((entry: any) => [entry.app, entry.minutes])) });
      if (Platform.OS !== 'android' || !UsageMonitor?.getUsageStats) { publish({ loading: false }); return; }
      const usage: AppUsage[] = await UsageMonitor.getUsageStats();
      const apps = usage.filter((entry) => entry.minutes > 0).sort((a, b) => b.minutes - a.minutes);
      if (!current()) return;
      publish({ today: apps, loading: false });
      if (!upload) return;
      const saved = await AsyncStorage.getItem(key);
      const cache: { week: ScreenTimeDay[]; pending: Record<string, AppUsage[]> } = saved ? JSON.parse(saved) : { week: [], pending: {} };
      cache.pending[todayKey()] = apps;
      cache.week = [...cache.week.filter((row) => row.date !== todayKey()), { date: todayKey(), apps }].slice(-90);
      await AsyncStorage.setItem(key, JSON.stringify(cache));
      if (!current()) return;
      publish({ week: cache.week });
      for (const date of Object.keys(cache.pending).sort()) {
        const res = await authedFetch(`${API_BASE_URL}/api/screentime`, { method: 'POST', body: JSON.stringify({ date, apps: cache.pending[date] }) }, uid);
        if (!res.ok) throw new Error('Screen time sync failed');
        if (!current()) return;
        delete cache.pending[date];
        await AsyncStorage.setItem(key, JSON.stringify(cache));
      }
      const res = await authedFetch(`${API_BASE_URL}/api/screentime/history?days=7`, {}, uid);
      if (!res.ok) throw new Error('Screen time history failed');
      const rows: ScreenTimeDay[] = await res.json();
      if (!current()) return;
      const merged = new Map(cache.week.map((row) => [row.date, row]));
      rows.forEach((row) => merged.set(row.date, row));
      cache.week = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
      await AsyncStorage.setItem(key, JSON.stringify(cache));
      if (current()) publish({ week: cache.week, syncError: false });
    } catch { if (current()) publish({ loading: false, syncError: true }); }
  };
  const promise = run().finally(() => inFlight.delete(uid));
  inFlight.set(uid, promise);
  return promise;
};

export const useScreenTimeSync = (uid?: string) => {
  useEffect(() => {
    publish(initial);
    if (!uid) return;
    void refreshScreenTime();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refreshScreenTime(); }, 30000);
    const active = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshScreenTime(); });
    return () => { clearInterval(timer); active.remove(); };
  }, [uid]);
};

export const trackedTotal = trackedUsageMinutes;
export const useScreenTime = () => {
  const [state, setState] = useState(store);
  useEffect(() => { listeners.add(setState); return () => { listeners.delete(setState); }; }, []);
  return { screenTime: state.today, tracked: state.tracked, limits: state.limits, week: state.week, loading: state.loading, syncError: state.syncError, totalToday: totalUsageMinutes(state.today), trackedToday: trackedTotal(state.today, state.tracked), refetch: refreshScreenTime };
};

export const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) return '0m';
  if (minutes < 1) return '<1m';
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  return hours ? `${hours}h ${total % 60}m` : `${total}m`;
};
