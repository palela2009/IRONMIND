import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, DeviceEventEmitter, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChallengeItem } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { usePro } from '../context/ProContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { EMPTY_PROGRESS, ProgressSnapshot, mergeHistory, projectProgress } from '../utils/progressState';
import { reportHandledError } from '../config/sentry';
import { appAlert } from '../components/AppDialog';
import { permanentRejection, rejectChallenge, retryRejected } from '../utils/progressQueue';
import { deviceTimeZone } from '../utils/challengeTime';
import { auth } from '../config/firebase';

const native = NativeModules.UsageMonitor;
const API = `${API_BASE_URL}/api/challenge`;

export const useStats = () => {
  const { fbUser } = useAuth();
  const { refresh: refreshPro } = usePro();
  const uid = fbUser?.uid;
  const uidRef = useRef(uid);
  uidRef.current = uid;
  const refreshProRef = useRef(refreshPro);
  refreshProRef.current = refreshPro;
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(EMPTY_PROGRESS);
  const [dailyChallengeLimit, setDailyLimit] = useState(5);
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'offline' | 'error'>('saved');
  const [syncMessage, setSyncMessage] = useState('');
  const [dismissedLoss, setDismissedLoss] = useState<string | null>(null);
  const [savedStreak, setSavedStreak] = useState<{ streak: number; source: 'freeze' | 'coins' | 'ad' } | null>(null);
  const stateRef = useRef(EMPTY_PROGRESS);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const readyRef = useRef<string | null>(null);

  const refreshSettings = useCallback(async () => {
    const raw = await AsyncStorage.getItem('@ironmind_onboarding');
    const data = raw ? JSON.parse(raw) : {};
    setDailyLimit(data.dailyChallengeLimit ?? 5);
    setMonitoredApps(data.targetApps ?? []);
    if (data.timeZone && stateRef.current.timeZone !== data.timeZone) {
      const next = { ...stateRef.current, timeZone: data.timeZone };
      stateRef.current = next;
      setSnapshot(next);
    }
  }, []);

  const save = async (account: string, next: ProgressSnapshot) => {
    if (auth.currentUser?.uid !== account) return;
    await AsyncStorage.setItem(`@ironmind_progress_v3:${account}`, JSON.stringify(next));
    if (uidRef.current !== account) return;
    stateRef.current = next;
    setSnapshot(next);
  };

  const serialize = (task: () => Promise<void>) => {
    const next = queueRef.current.then(task, task);
    queueRef.current = next.catch(() => {});
    return next;
  };

  const sync = useCallback((retry = false) => {
    const account = uidRef.current;
    if (!account) return Promise.resolve();
    return serialize(async () => {
      if (uidRef.current !== account || readyRef.current !== account) return;
      try {
        if (retry) await save(account, retryRejected(stateRef.current));
        if (native?.getPendingResults) {
          const results: (ChallengeItem & { uid: string })[] = JSON.parse(await native.getPendingResults(account));
          for (const item of results.sort((a, b) => a.timestamp - b.timestamp)) {
            if (uidRef.current !== account) return;
            const current = stateRef.current;
            if (!current.pending.some((r) => r.id === item.id) && !current.history.some((r) => r.id === item.id) && !current.rejected?.some((r) => r.item.id === item.id)) {
              await save(account, { ...current, pending: [...current.pending, item] });
            }
            await native.acknowledgeResult(account, item.id);
          }
        }
        setSyncStatus('syncing');
        setSyncMessage('Syncing your progress…');
        while (stateRef.current.pending.length && uidRef.current === account) {
          const item = stateRef.current.pending[0];
          const res = await authedFetch(`${API}/result`, {
            method: 'POST', body: JSON.stringify({ ...item, eventId: item.id }),
          }, account);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (permanentRejection(res.status)) {
              await save(account, rejectChallenge(stateRef.current, item, body.message ?? 'Result could not be validated'));
              continue;
            }
            throw new Error(res.status < 500 ? body.message ?? 'Progress needs attention. Tap to retry.' : 'Server unavailable. Your results are saved on this phone.');
          }
          const cloud = await res.json();
          if (uidRef.current !== account) return;
          if (!cloud.stats || !Array.isArray(cloud.history)) throw new Error('The server needs the progress update. Your results are saved on this phone.');
          const next = { ...stateRef.current, stats: cloud.stats, streakFreezes: cloud.streakFreezes, timeZone: cloud.timeZone ?? stateRef.current.timeZone, history: mergeHistory(stateRef.current.history, cloud.history), pending: stateRef.current.pending.filter((r) => r.id !== item.id) };
          await save(account, next);
          if (cloud.result?.freezeUsed && !cloud.duplicate) setSavedStreak({ streak: cloud.stats.currentStreak, source: 'freeze' });
        }
        if (uidRef.current !== account) return;
        const res = await authedFetch(`${API}/progress`, {}, account);
        if (!res.ok) throw new Error('Could not refresh cloud progress. Tap to retry.');
        const cloud = await res.json();
        if (uidRef.current !== account) return;
        await save(account, { ...stateRef.current, stats: cloud.stats, streakFreezes: cloud.streakFreezes, timeZone: cloud.timeZone ?? stateRef.current.timeZone, history: mergeHistory(stateRef.current.history, cloud.history) });
        if (cloud.timeZone) native?.setChallengeTimeZone?.(cloud.timeZone);
        const rejected = stateRef.current.rejected?.length ?? 0;
        setSyncStatus(rejected ? 'error' : 'saved');
        setSyncMessage(rejected ? `${rejected} saved results need review. Other progress is synced.` : 'Progress synced');
        void refreshProRef.current();
      } catch (error) {
        if (uidRef.current !== account) return;
        setSyncStatus('offline');
        setSyncMessage(error instanceof Error ? error.message : 'Saved on this phone. Tap to retry.');
      }
    });
  }, []);

  useEffect(() => {
    readyRef.current = null;
    stateRef.current = EMPTY_PROGRESS;
    setSnapshot(EMPTY_PROGRESS);
    setDismissedLoss(null);
    setSavedStreak(null);
    if (!uid) return;
    const account = uid;
    let cancelled = false;
    const initialize = async () => {
      try {
        const raw = await AsyncStorage.getItem(`@ironmind_progress_v3:${account}`);
        let next: ProgressSnapshot = raw ? JSON.parse(raw) : { ...EMPTY_PROGRESS, timeZone: deviceTimeZone(), rejected: [] };
        if (!raw) {
          const [oldStats, oldHistory] = await Promise.all([AsyncStorage.getItem('@ironmind_stats_v2'), AsyncStorage.getItem('@ironmind_history_v2')]);
          next = { ...next, stats: oldStats ? JSON.parse(oldStats) : next.stats, history: oldHistory ? JSON.parse(oldHistory) : [] };
        }
        if (cancelled) return;
        await save(account, next);
        await refreshSettings();
        if (cancelled) return;
        readyRef.current = account;
        await sync();
      } catch (error) {
        reportHandledError(error, { operation: 'load_progress' });
        if (!cancelled) { setSyncStatus('error'); setSyncMessage('Could not load saved progress. Reopen IRONMIND to retry.'); }
      }
    };
    void initialize();
    const listener = DeviceEventEmitter.addListener('IronmindChallengeResult', () => { void sync(); });
    const active = AppState.addEventListener('change', (state) => { if (state === 'active') void sync(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void sync(); }, 30000);
    return () => { cancelled = true; listener.remove(); active.remove(); clearInterval(timer); };
  }, [uid, sync, refreshSettings]);

  const projected = projectProgress(snapshot, dailyChallengeLimit);
  const lossId = projected.stats.reclaimableEventId ?? null;
  const reclaimStreak = async (_source: 'ad' | 'coins') => {
    if (_source !== 'coins') return false;
    const account = uidRef.current;
    if (!account || !lossId) return false;
    await sync();
    let success = false;
    await serialize(async () => {
      try {
        if (uidRef.current !== account || stateRef.current.pending.length) throw new Error('Connect to the internet and sync your challenges before reclaiming.');
        const res = await authedFetch(`${API}/reclaim`, { method: 'POST', body: JSON.stringify({ eventId: lossId }) }, account);
        const body = await res.json();
        if (!res.ok) throw new Error(body.message ?? 'Could not reclaim your streak');
        if (uidRef.current !== account) return;
        await save(account, { ...stateRef.current, stats: body.stats, streakFreezes: body.streakFreezes, history: mergeHistory(stateRef.current.history, body.history) });
        setSavedStreak({ streak: body.stats.currentStreak, source: 'coins' });
        void refreshProRef.current();
        success = true;
      } catch (error) { appAlert('Streak not reclaimed', error instanceof Error ? error.message : 'Try again.'); }
    });
    return success;
  };

  const today = new Date().setHours(0, 0, 0, 0);
  return {
    challengeTimeZone: snapshot.timeZone ?? deviceTimeZone(),
    stats: projected.stats, history: projected.history, monitoredApps,
    challengesToday: projected.history.filter((item) => item.timestamp >= today && item.counted !== false).length,
    lostStreak: lossId !== dismissedLoss ? projected.stats.lostStreak ?? 0 : 0,
    reclaimStreak, dismissLostStreak: () => setDismissedLoss(lossId), savedStreak,
    dismissSavedStreak: () => setSavedStreak(null), DAILY_CHALLENGE_LIMIT: dailyChallengeLimit,
    refreshSettings, syncStatus, syncMessage, pendingCount: snapshot.pending.length, rejectedCount: snapshot.rejected?.length ?? 0, retrySync: () => sync(true),
  };
};
