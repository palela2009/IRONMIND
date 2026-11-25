import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { AppUsage } from './useScreenTime';
import { useLiveRefresh } from './useLiveRefresh';

const { UsageMonitor } = NativeModules;
const API_URL = `${API_BASE_URL}/api/duels`;

export type DuelStatus = 'pending' | 'active' | 'completed' | 'declined' | 'void' | 'cancelled';

export interface Duel {
  id: string;
  app: string;
  apps: string[];
  stake: number;
  status: DuelStatus;
  resolutionReason: string | null;
  startAt: string | null;
  endAt: string | null;
  opponentUid: string;
  opponentName: string;
  opponentPhotoURL: string | null;
  myMinutes: number | null;
  theirMinutes: number | null;
  theirReportedAt: string | null;
  myReactedAt: string | null;
  theirReaction: string | null;
  theirReactedAt: string | null;
  iWon: boolean | null;
  incoming: boolean;
}

export const DUEL_REACTIONS: { id: string; text: string }[] = [
  { id: 'fire', text: '🔥 Put the phone down' },
  { id: 'comeon', text: '📉 The feed owns you' },
  { id: 'winning', text: '🧊 Too easy so far' },
  { id: 'gg', text: '🤝 Respect. Rematch?' },
];

export const reactionText = (id: string | null): string | null =>
  DUEL_REACTIONS.find((r) => r.id === id)?.text ?? null;

export const appsOf = (d: Duel): string[] => (d.apps?.length ? d.apps : [d.app]);

const measureWindow = async (apps: string[], startAt: string, endAt: string): Promise<number | null> => {
  if (Platform.OS !== 'android' || !UsageMonitor?.getUsageForRange) return null;
  try {
    const start = new Date(startAt).getTime();
    const end = Math.min(Date.now(), new Date(endAt).getTime());

    if (!(end > start)) return 0;

    const usage: AppUsage[] = await UsageMonitor.getUsageForRange(start, end);
    return usage.filter((u) => apps.includes(u.app)).reduce((sum, u) => sum + u.minutes, 0);
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
        const minutes = await measureWindow(appsOf(d), d.startAt!, d.endAt!);
        if (minutes === null) return;
        await authedFetch(`${API_URL}/${d.id}/report`, {
          method: 'POST',
          body: JSON.stringify({ minutes }),
        }).catch(() => {});
      })
    );
  } catch {}
};

export const useDuels = (pollEnabled = true) => {
  const { fbUser } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchDuels = useCallback(async (): Promise<Duel[]> => {
    const res = await authedFetch(API_URL);
    if (!res.ok) throw new Error('Could not load duels');
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
      setError('');
      setDuels(list);

      const active = list.filter((d) => d.status === 'active' && d.startAt && d.endAt);
      if (active.length > 0) {
        const reports = await Promise.all(
          active.map(async (d) => {
            const minutes = await measureWindow(appsOf(d), d.startAt!, d.endAt!);
            if (minutes === null) return false;
            try {
              const response = await authedFetch(`${API_URL}/${d.id}/report`, {
                method: 'POST',
                body: JSON.stringify({ minutes }),
              });
              return response.ok;
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

  useLiveRefresh(load, !!fbUser?.uid && pollEnabled);

  const challenge = async (toUid: string, apps: string[], stake = 50): Promise<string | null> => {
    setError('');
    try {
      const res = await authedFetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ toUid, apps, stake }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return body.message ?? 'Could not send challenge';
      await load();
      return null;
    } catch {
      return 'Network error — try again';
    }
  };

  const cancel = async (id: string): Promise<string | null> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/${id}/cancel`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body.message ?? 'Could not cancel duel';
        setError(msg);
        return msg;
      }
      await load();
      return null;
    } catch {
      const msg = 'Network error — try again';
      setError(msg);
      return msg;
    }
  };

  const respond = async (id: string, action: 'accept' | 'decline'): Promise<string | null> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/${id}/${action}`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body.message ?? `Could not ${action} duel`;
        setError(msg);
        return msg;
      }
      await load();
      return null;
    } catch {
      const msg = 'Network error — try again';
      setError(msg);
      return msg;
    }
  };

  const react = async (id: string, reaction: string): Promise<string | null> => {
    try {
      const res = await authedFetch(`${API_URL}/${id}/react`, {
        method: 'POST',
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return body.message ?? 'Could not send';
      }
      setDuels(await fetchDuels());
      return null;
    } catch {
      return 'Network error — try again';
    }
  };

  return { duels, loading, error, challenge, respond, cancel, react, refresh: load };
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
