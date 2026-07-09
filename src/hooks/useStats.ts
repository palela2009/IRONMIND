import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserStats, ChallengeItem } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';

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

  useEffect(() => {
    load(fbUser?.uid);
    loadMonitoredApps();
  }, [fbUser?.uid]);

  const loadMonitoredApps = async () => {
    try {
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.targetApps?.length > 0) setMonitoredApps(data.targetApps);
      }
    } catch {}
  };

  const load = async (userId?: string) => {
    try {
      const [rawStats, rawHistory] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.STATS),
        AsyncStorage.getItem(STORAGE_KEYS.HISTORY),
      ]);

      let localStats = INITIAL_STATS;
      if (rawStats) {
        localStats = JSON.parse(rawStats);
        setStats(localStats);
      }
      if (rawHistory) setHistory(JSON.parse(rawHistory));

      if (userId) {
        const res = await fetch(`${API_URL}/stats/${userId}`);
        if (res.ok) {
          const cloud = await res.json();
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
      }
    } catch {}
  };

  const persist = async (updatedStats: UserStats, updatedHistory: ChallengeItem[], userId?: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));

      if (userId) {
        await fetch(`${API_URL}/stats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            currentStreak: updatedStats.currentStreak,
            longestStreak: updatedStats.longestStreak,
            bestReactionTime: updatedStats.bestReactionTime,
            totalChallenges: updatedStats.totalChallenges,
            successCount: updatedStats.successCount,
            currentXP: updatedStats.currentXP,
            level: updatedStats.level,
          }),
        });
      }
    } catch {}
  };

  const recordChallenge = async (elapsedTime: number, targetApp: string, success: boolean) => {
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
      level: Math.floor(newXP / 500) + 1,
    };

    const newItem: ChallengeItem = {
      id: Date.now().toString(),
      targetApp,
      elapsedTime: success ? elapsedTime : -1,
      timestamp: Date.now(),
      wasSuccessful: success,
    };

    const updatedHistory = [newItem, ...history];
    setStats(updatedStats);
    setHistory(updatedHistory);
    await persist(updatedStats, updatedHistory, fbUser?.uid);
  };

  return { stats, history, monitoredApps, recordChallenge };
};
