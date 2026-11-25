import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { todayKey } from './useScreenTime';
import { useLiveRefresh } from './useLiveRefresh';

const API_URL = `${API_BASE_URL}/api/friends`;

export interface Friend {
  uid: string;
  displayName: string;
  photoURL: string | null;
  currentStreak: number;
  longestStreak: number;
  totalChallenges: number;
  level: number;
  successCount: number;
  bestReactionTime: number;
  currentXP: number;
  isPro: boolean;
  isOwner: boolean;
  frame: string | null;
  nameEffect: string | null;
  todayMinutes: number;
  hasTodayData?: boolean;
  weekAvgMinutes: number;
  trackedApps: string[];
}

export interface FriendRequestItem {
  id: string;
  fromUid: string;
  displayName: string;
  photoURL: string | null;
  createdAt: string;
}

export type AddOutcome = 'accepted' | 'pending' | 'error';

export const useFriends = (pollEnabled = true) => {
  const { fbUser } = useAuth();
  const [code, setCode] = useState<string>('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    if (!fbUser?.uid) {
      setCode('');
      setFriends([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      const [codeRes, friendsRes, requestsRes] = await Promise.all([
        authedFetch(`${API_URL}/code`),
        authedFetch(`${API_URL}?date=${todayKey()}`),
        authedFetch(`${API_URL}/requests`),
      ]);
      if (codeRes.ok) setCode((await codeRes.json()).code ?? '');
      if (friendsRes.ok) setFriends(await friendsRes.json());
      if (requestsRes.ok) setRequests(await requestsRes.json());
    } catch {}
    setLoading(false);
  }, [fbUser?.uid]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveRefresh(load, !!fbUser?.uid && pollEnabled);

  const addByCode = async (inputCode: string): Promise<AddOutcome> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/add`, {
        method: 'POST',
        body: JSON.stringify({ code: inputCode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? 'Could not add friend');
        return 'error';
      }
      await load();
      return body.status === 'accepted' ? 'accepted' : 'pending';
    } catch {
      setError('Network error — try again');
      return 'error';
    }
  };

  const acceptRequest = async (id: string): Promise<string | null> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/requests/${id}/accept`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.message ?? 'Could not accept request';
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

  const rejectRequest = async (id: string): Promise<string | null> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/requests/${id}/reject`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.message ?? 'Could not reject request';
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

  const removeFriend = async (uid: string): Promise<boolean> => {
    setError('');
    try {
      const res = await authedFetch(`${API_URL}/${uid}`, { method: 'DELETE' });
      if (!res.ok) return false;
      await load();
      return true;
    } catch {
      return false;
    }
  };

  return { code, friends, requests, loading, error, addByCode, acceptRequest, rejectRequest, removeFriend, refresh: load };
};
