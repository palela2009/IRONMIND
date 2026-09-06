import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { AppUsage } from './useScreenTime';

export interface DayUsage {
  date: string;
  total: number;
  apps: AppUsage[];
}

export const useAnalytics = (days = 30) => {
  const { fbUser } = useAuth();
  const [history, setHistory] = useState<DayUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!fbUser?.uid) {
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await authedFetch(`${API_BASE_URL}/api/screentime/history?days=${days}`);
      if (res.ok) setHistory(await res.json());
    } catch {}
    setLoading(false);
  }, [fbUser?.uid, days]);

  useEffect(() => {
    load();
  }, [load]);

  return { history, loading, refresh: load };
};

export const dayLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00`);
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
};

// Splits a run of days down the middle and compares the halves. A trend needs a
// like-for-like comparison; yesterday against today would just be noise.
export const trendFor = (values: number[]): { change: number; hasData: boolean } => {
  if (values.length < 4) return { change: 0, hasData: false };
  const mid = Math.floor(values.length / 2);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
  const before = avg(values.slice(0, mid));
  const after = avg(values.slice(mid));
  if (before === 0) return { change: 0, hasData: false };
  return { change: ((after - before) / before) * 100, hasData: true };
};
