import { useState, useEffect, useCallback } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { AppUsage } from './useScreenTime';

const { UsageMonitor } = NativeModules;
const API_URL = `${API_BASE_URL}/api/duels`;

export type DuelStatus = 'pending' | 'active' | 'completed' | 'declined' | 'void';

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

// Measures this device's own usage of one app across the duel's exact window. Reads the
// window straight from UsageStatsManager's event stream rather than the daily screen-time
// buckets, because a rolling 24h duel almost never lines up with a calendar day.
const measureWindow = async (app: string, startAt: string, endAt: string): Promise<number | null> => {
  if (Platform.OS !== 'android' || !UsageMonitor?.getUsageForRange) return null;
  try {
    const start = new Date(startAt).getTime();
    // Clamped to the window's end so a duel that has already closed reports the usage it
    // actually finished on, not everything since.
    const end = Math.min(Date.now(), new Date(endAt).getTime());
    if (!(end > start)) return null;

    const usage: AppUsage[] = await UsageMonitor.getUsageForRange(start, end);
    // Absent from the list means the app was never opened in the window — a real zero, not
    // missing data, so it must report 0 rather than null (null would void the duel).
    return usage.find((u) => u.app === app)?.minutes ?? 0;
  } catch {
    return null;
  }
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

      // Report usage for every live duel, then re-fetch. Reporting has to happen after the
      // first fetch (that's how we learn which duels exist) but the server's grace period
      // keeps expired duels unsettled long enough for these final numbers to count.
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

  return { duels, loading, error, challenge, respond, refresh: load };
};

// "3h 12m left", or a settled state once the window has closed.
export const formatTimeLeft = (endAt: string | null): string => {
  if (!endAt) return '';
  const ms = new Date(endAt).getTime() - Date.now();
  if (ms <= 0) return 'SETTLING';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m LEFT` : `${minutes}m LEFT`;
};
