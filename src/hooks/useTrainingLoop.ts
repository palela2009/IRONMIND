import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrainingState, RepHistoryItem, UserStats } from '../types/training';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://10.0.2.2:5000/api/stats';

const STORAGE_KEYS = {
  STATS: '@ironmind_stats',
  HISTORY: '@ironmind_history',
};

const APP_URLS: Record<string, { deep: string; web: string }> = {
  YouTube: { deep: 'vnd.youtube://', web: 'https://www.youtube.com' },
  Instagram: { deep: 'instagram://', web: 'https://www.instagram.com' },
  TikTok: { deep: 'snssdk1233://', web: 'https://www.tiktok.com' },
  'X (Twitter)': { deep: 'twitter://', web: 'https://www.twitter.com' },
  Reddit: { deep: 'reddit://', web: 'https://www.reddit.com' },
  Facebook: { deep: 'fb://', web: 'https://www.facebook.com' },
  Snapchat: { deep: 'snapchat://', web: 'https://www.snapchat.com' },
};

const INITIAL_STATS: UserStats = {
  currentStreak: 0,
  longestStreak: 0,
  bestReactionTime: 0,
  totalReps: 0,
  currentXP: 0,
  level: 1,
};

export const useTrainingLoop = () => {
  const { fbUser } = useAuth();
  const [trainingState, setTrainingState] = useState<TrainingState>('HOME');
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [history, setHistory] = useState<RepHistoryItem[]>([]);
  const [lastElapsedTime, setLastElapsedTime] = useState<number>(0);
  const [triggerFiredAt, setTriggerFiredAt] = useState<number>(0);
  const [currentTargetApp, setCurrentTargetApp] = useState<string>('YouTube');
  const [targetApps, setTargetApps] = useState<string[]>(['YouTube']);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasInBackgroundRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPersistedData(fbUser?.uid);
  }, [fbUser?.uid]);

  useEffect(() => {
    AsyncStorage.getItem('@ironmind_onboarding').then((raw) => {
      if (raw) {
        const data = JSON.parse(raw);
        if (data.targetApps?.length > 0) setTargetApps(data.targetApps);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (trainingState !== 'WAIT') return;

    const randomDelay = 3000 + Math.floor(Math.random() * 10001);

    timerRef.current = setTimeout(async () => {
      const appToOpen = targetApps[Math.floor(Math.random() * targetApps.length)];
      const now = Date.now();

      startTimeRef.current = now;
      setTriggerFiredAt(now);
      setCurrentTargetApp(appToOpen);
      setTrainingState('REP');

      const urls = APP_URLS[appToOpen] ?? APP_URLS['YouTube'];
      try {
        await Linking.openURL(urls.deep);
      } catch {
        try { await Linking.openURL(urls.web); } catch {}
      }
    }, randomDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trainingState, targetApps]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [trainingState]);

  const loadPersistedData = async (userId?: string) => {
    try {
      const savedStats = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
      let localStats = INITIAL_STATS;

      if (savedStats) {
        localStats = JSON.parse(savedStats);
        setStats(localStats);
      }
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      if (userId) {
        const response = await fetch(`${API_URL}/${userId}`);
        if (response.ok) {
          const cloud = await response.json();
          if (cloud.totalReps === 0 && localStats.totalReps > 0) {
            await saveData(localStats, savedHistory ? JSON.parse(savedHistory) : [], userId);
          } else {
            const parsed: UserStats = {
              currentStreak: cloud.currentStreak,
              longestStreak: cloud.longestStreak || cloud.currentStreak,
              bestReactionTime: cloud.bestReactionTime,
              totalReps: cloud.totalReps,
              currentXP: cloud.currentXP,
              level: cloud.level,
            };
            setStats(parsed);
            await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(parsed));
          }
        }
      }
    } catch {}
  };

  const saveData = async (updatedStats: UserStats, updatedHistory: RepHistoryItem[], userId?: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));

      if (userId) {
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            level: updatedStats.level,
            currentXP: updatedStats.currentXP,
            currentStreak: updatedStats.currentStreak,
            totalReps: updatedStats.totalReps,
            bestReactionTime: updatedStats.bestReactionTime,
          }),
        });
      }
    } catch {}
  };

  const executeCloseRep = () => {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    setLastElapsedTime(elapsed);

    if (elapsed <= 4.0) {
      const xpEarned = 50 + (stats.currentStreak >= 5 ? 10 : 0);
      const newStreak = stats.currentStreak + 1;
      const newBest = stats.bestReactionTime === 0
        ? elapsed
        : Math.min(elapsed, stats.bestReactionTime);
      const newXP = stats.currentXP + xpEarned;

      const updatedStats: UserStats = {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, stats.longestStreak),
        bestReactionTime: newBest,
        totalReps: stats.totalReps + 1,
        currentXP: newXP,
        level: Math.floor(newXP / 500) + 1,
      };

      const newItem: RepHistoryItem = {
        id: Date.now().toString(),
        targetApp: currentTargetApp,
        elapsedTime: elapsed,
        timestamp: Date.now(),
        xpEarned,
        wasSuccessful: true,
      };

      const updatedHistory = [newItem, ...history];
      setStats(updatedStats);
      setHistory(updatedHistory);
      setTrainingState('RSLT');
      saveData(updatedStats, updatedHistory, fbUser?.uid);
    } else {
      const updatedStats = { ...stats, currentStreak: 0 };
      setStats(updatedStats);
      setTrainingState('FAIL');
      saveData(updatedStats, history, fbUser?.uid);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'background') {
      wasInBackgroundRef.current = true;
    } else if (nextAppState === 'active') {
      if (wasInBackgroundRef.current && trainingState === 'REP') {
        wasInBackgroundRef.current = false;
        executeCloseRep();
      } else {
        wasInBackgroundRef.current = false;
      }
    }
    appStateRef.current = nextAppState;
  };

  const resetToIdle = () => setTrainingState('HOME');

  return {
    trainingState,
    setTrainingState,
    stats,
    history,
    lastElapsedTime,
    triggerFiredAt,
    currentTargetApp,
    executeCloseRep,
    resetToIdle,
  };
};
