import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { AppUsage } from './useScreenTime';

const { UsageMonitor } = NativeModules;
const API_URL = `${API_BASE_URL}/api/duels`;

export type DuelStatus = 'pending' | 'active' | 'completed' | 'declined' | 'void' | 'cancelled';

export interface Duel {
  id: string;
  app: string;
  stake: number;
  status: DuelStatus;
  startAt: string | null;
  endAt: string | null;
  opponentUid: string;
  opponentName: string;
  opponentPhotoURL: string | null;
  myMinutes: number | null;
  theirMinutes: number | null;
  theirReportedAt: string | null;
  iWon: boolean | null;
  incoming: boolean;
}

const measureWindow = async (app: string, startAt: string, endAt: string): Promise<number | null> => {
  if (Platform.OS !== 'android' || !UsageMonitor?.getUsageForRange) return null;
  try {
    const start = new Date(startAt).getTime();
    const end = Math.min(Date.now(), new Date(endAt).getTime());

    if (!(end > start)) return 0;

    const usage: AppUsage[] = await UsageMonitor.getUsageForRange(start, end);
    return usage.find((u) => u.app === app)?.minutes ?? 0;
  } catch {
    return null;
  }
};

export const reportActiveDuels = async (): Promise<void> => {
  try {
    const res = await authedFetch(API_URL);
    if (!res.ok) return;
    const list: Duel[] = await res.json();

    const active = list.filter((d) => d.status === 'active' && d.startAt && d.endAt);
    await Promise.all(
      active.map(async (d) => {
        const minutes = await measureWindow(d.app, d.startAt!, d.endAt!);
        if (minutes === null) return;
        await authedFetch(`${API_URL}/${d.id}/report`, {
          method: 'POST',
          body: JSON.stringify({ minutes }),
        }).catch(() => {});
      })
    );
  } catch {}
};

export const useDuels = () => {
  const { fbUser } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchDuels = useCallback(async (): Promise<Duel[]> => {
    const res = await authedFetch(API_URL);
    if (!res.ok) return [];
    return res.json();
  }, []);

  const load = useCallback(async () => {
    if (!fbUser?.uid) {
      setDuels([]);
      setLoading(false);
      return;
    }
    try {
      const list = await fetchDuels();
      setDuels(list);

      const active = list.filter((d) => d.status === 'active' && d.startAt && d.endAt);
      if (active.length > 0) {
        const reports = await Promise.all(
          active.map(async (d) => {
            const minutes = await measureWindow(d.app, d.startAt!, d.endAt!);
            if (minutes === null) return false;
            try {
              await authedFetch(`${API_URL}/${d.id}/report`, {
                method: 'POST',
                body: JSON.stringify({ minutes }),
              });
              return true;
            } catch {
              return false;
            }
          })
        );
        if (reports.some(Boolean)) {
          setDuels(await fetchDuels());
        }
      }
    } catch {
      setError('Could not load duels');
    }
    setLoading(false);
  }, [fbUser?.uid, fetchDuels]);

  useEffect(() => {
    load();
  }, [load]);

  const hasActiveDuel = duels.some((d) => d.status === 'active');

  useEffect(() => {
    if (!hasActiveDuel || !fbUser?.uid) return;

    const id = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, 60_000);

    return () => clearInterval(id);
  }, [hasActiveDuel, fbUser?.uid, load]);

  const challenge = async (toUid: string, app: string, stake = 100): Promise<boolean> => {
    setError('');
    try {
      const res = await authedFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ toUid, app, stake }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? 'Could not send challenge');
        return false;
      }
      await load();
      return true;
    } catch {
      setError('Network error — try again');
      return false;
    }
  };

  const cancel = async (id: string): Promise<boolean> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/${id}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Could not cancel duel');
        return false;
      }
      await load();
      return true;
    } catch {
      setError('Network error — try again');
      return false;
    }
  };

  const respond = async (id: string, action: 'accept' | 'decline'): Promise<boolean> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/${id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error(`[IRONMIND] Duel ${action} failed:`, res.status, body);
        setError(body.message ?? `Could not ${action} duel`);
        return false;
      }
      await load();
      return true;
    } catch (e) {
      console.error(`[IRONMIND] Duel ${action} error:`, e);
      setError('Network error — try again');
      return false;
    }
  };

  return { duels, loading, error, challenge, respond, cancel, refresh: load };
};

export const formatAgo = (iso: string | null): string => {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

export const formatTimeLeft = (endAt: string | null): string => {
  if (!endAt) return '';
  const ms = new Date(endAt).getTime() - Date.now();
  if (ms <= 0) return 'SETTLING';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m LEFT` : `${minutes}m LEFT`;
};
