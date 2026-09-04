import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserStats, ChallengeItem } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';
import { XP_PER_LEVEL } from '../constants/leveling';
import { DAILY_LIMIT_VALUES, DEFAULT_DAILY_LIMIT } from '../constants/dailyLimit';

const API_URL = `${API_BASE_URL}/api`;

const STORAGE_KEYS = {
  STATS: '@ironmind_stats_v2',
  HISTORY: '@ironmind_history_v2',
};

const INITIAL_STATS: UserStats = {
  currentStreak: 0,
  longestStreak: 0,
  bestReactionTime: 0,
  totalChallenges: 0,
  successCount: 0,
  currentXP: 0,
  level: 1,
};

export const useStats = () => {
  const { fbUser } = useAuth();
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [history, setHistory] = useState<ChallengeItem[]>([]);
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [dailyChallengeLimit, setDailyChallengeLimit] = useState<number>(DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT]);

  useEffect(() => {
    load(fbUser?.uid);
    loadMonitoredApps();
  }, [fbUser?.uid]);

  const loadMonitoredApps = async () => {
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      const data = raw ? JSON.parse(raw) : null;
      // Set unconditionally (not just when present) — otherwise switching to an account
      // with no onboarding data yet would leave the previous account's values in memory.
      setMonitoredApps(data?.targetApps?.length > 0 ? data.targetApps : []);
      setDailyChallengeLimit(data?.dailyChallengeLimit ?? DAILY_LIMIT_VALUES[DEFAULT_DAILY_LIMIT]);
    } catch {}
  };

  const load = async (userId?: string) => {
    try {
      const [rawStats, rawHistory] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STATS),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
      ]);

      // Set unconditionally, same fix as loadMonitoredApps below — otherwise switching to
      // (or deleting into) an account with an empty local cache left stats/history frozen
      // on whatever the PREVIOUS account's values were, since setStats/setHistory were
      // only ever called when data was actually found.
      const localStats: UserStats = rawStats ? JSON.parse(rawStats) : INITIAL_STATS;
      const localHistory: ChallengeItem[] = rawHistory ? JSON.parse(rawHistory) : [];
      setStats(localStats);
      setHistory(localHistory);

      if (!userId) return;

      const [statsRes, historyRes] = await Promise.all([
        authedFetch(`${API_URL}/stats/${userId}`),
        authedFetch(`${API_URL}/challenge/results`),
      ]);

      if (statsRes.ok) {
        const cloud = await statsRes.json();
        if (cloud.totalChallenges > localStats.totalChallenges) {
          const parsed: UserStats = {
            currentStreak: cloud.currentStreak ?? 0,
            longestStreak: cloud.longestStreak ?? 0,
            bestReactionTime: cloud.bestReactionTime ?? 0,
            totalChallenges: cloud.totalChallenges ?? 0,
            successCount: cloud.successCount ?? 0,
            currentXP: cloud.currentXP ?? 0,
            level: cloud.level ?? 1,
          };
          setStats(parsed);
          await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(parsed));
        }
      }

      if (historyRes.ok) {
        const cloudHistory: ChallengeItem[] = await historyRes.json();
        // Cloud wins when it holds more than this device does — covers both a fresh
        // install and an account switch, which each start with nothing stored locally.
        if (cloudHistory.length > localHistory.length) {
          setHistory(cloudHistory);
          await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(cloudHistory));
        }
      }
    } catch {}
  };

  const persist = async (updatedStats: UserStats, updatedHistory: ChallengeItem[], newItem: ChallengeItem, userId?: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));

      if (userId) {
        await authedFetch(`${API_URL}/stats`, {
          method: 'POST',
          body: JSON.stringify({
            currentStreak: updatedStats.currentStreak,
            longestStreak: updatedStats.longestStreak,
            bestReactionTime: updatedStats.bestReactionTime,
            totalChallenges: updatedStats.totalChallenges,
            successCount: updatedStats.successCount,
            currentXP: updatedStats.currentXP,
            level: updatedStats.level,
          }),
        });
        // Aggregate totals above cover Home/Profile displays, but nothing previously
        // persisted the individual challenge record — history only ever lived in local
        // AsyncStorage, invisible in MongoDB and lost on reinstall/device switch.
        await authedFetch(`${API_URL}/challenge/result`, {
          method: 'POST',
          body: JSON.stringify({
            targetApp: newItem.targetApp,
            elapsedTime: newItem.elapsedTime,
            wasSuccessful: newItem.wasSuccessful,
            timestamp: newItem.timestamp,
          }),
        });
      }
    } catch {}
  };

  const getTodayStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  };

  const recordChallenge = async (elapsedTime: number, targetApp: string, success: boolean) => {
    const todayStart = getTodayStart();
    const todayCount = history.filter((item) => item.timestamp >= todayStart).length;

    if (todayCount >= dailyChallengeLimit) return;

    const xpEarned = success ? 50 + (stats.currentStreak >= 5 ? 10 : 0) : 0;
    const newStreak = success ? stats.currentStreak + 1 : 0;
    const newBest = success && elapsedTime > 0
      ? stats.bestReactionTime === 0
        ? elapsedTime
        : Math.min(elapsedTime, stats.bestReactionTime)
      : stats.bestReactionTime;
    const newXP = stats.currentXP + xpEarned;

    const updatedStats: UserStats = {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, stats.longestStreak),
      bestReactionTime: newBest,
      totalChallenges: stats.totalChallenges + 1,
      successCount: stats.successCount + (success ? 1 : 0),
      currentXP: newXP,
      level: Math.floor(newXP / XP_PER_LEVEL) + 1,
    };

    const newItem: ChallengeItem = {
      id: Date.now().toString(),
      targetApp,
      elapsedTime,
      timestamp: Date.now(),
      wasSuccessful: success,
    };

    const updatedHistory = [newItem, ...history];
    setStats(updatedStats);
    setHistory(updatedHistory);
    await persist(updatedStats, updatedHistory, newItem, fbUser?.uid);
  };

  const todayStart = getTodayStart();
  const challengesToday = history.filter((item) => item.timestamp >= todayStart).length;

  return {
    stats,
    history,
    monitoredApps,
    recordChallenge,
    challengesToday,
    DAILY_CHALLENGE_LIMIT: dailyChallengeLimit,
    refreshSettings: loadMonitoredApps,
  };
};
