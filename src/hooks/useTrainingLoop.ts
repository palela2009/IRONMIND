import { useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrainingState, RepHistoryItem, UserStats } from '../types/training';

const STORAGE_KEYS = {
  STATS: '@ironmind_stats',
  HISTORY: '@ironmind_history',
};

const INITIAL_STATS: UserStats = {
  currentStreak: 7,
  longestStreak: 12,
  bestReactionTime: 0.74,
  totalReps: 142,
  currentXP: 320,
  level: 4,
};

export const useTrainingLoop = () => {
  const [trainingState, setTrainingState] = useState<TrainingState>('HOME');
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [history, setHistory] = useState<RepHistoryItem[]>([]);
  const [lastElapsedTime, setLastElapsedTime] = useState<number>(0);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    loadPersistedData();
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [trainingState]);

  const loadPersistedData = async () => {
    try {
      const savedStats = await AsyncStorage.getItem(STORAGE_KEYS.STATS);
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.HISTORY);
      if (savedStats) setStats(JSON.parse(savedStats));
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (error) {
      console.error(error);
    }
  };

  const saveData = async (updatedStats: UserStats, updatedHistory: RepHistoryItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
      await AsyncStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error(error);
    }
  };

  const startTrainingSequence = () => {
    setTrainingState('WAIT');
  };

  const triggerMockAppOpen = () => {
    startTimeRef.current = Date.now();
    setTrainingState('REP');
  };

  const executeCloseRep = () => {
    const endTime = Date.now();
    const elapsedSeconds = (endTime - startTimeRef.current) / 1000;
    setLastElapsedTime(elapsedSeconds);

    if (elapsedSeconds <= 4.0) {
      const baseXP = 50;
      const streakBonus = stats.currentStreak >= 5 ? 10 : 0;
      const totalEarnedXP = baseXP + streakBonus;

      const newReps = stats.totalReps + 1;
      const newStreak = stats.currentStreak + 1;
      const newLongest = newStreak > stats.longestStreak ? newStreak : stats.longestStreak;
      const newBest = elapsedSeconds < stats.bestReactionTime ? elapsedSeconds : stats.bestReactionTime;
      const newXP = stats.currentXP + totalEarnedXP;
      const newLevel = Math.floor(newXP / 500) + 1;

      const updatedStats: UserStats = {
        currentStreak: newStreak,
        longestStreak: newLongest,
        bestReactionTime: newBest,
        totalReps: newReps,
        currentXP: newXP,
        level: newLevel,
      };

      const newHistoryItem: RepHistoryItem = {
        id: endTime.toString(),
        targetApp: 'Instagram',
        elapsedTime: elapsedSeconds,
        timestamp: endTime,
        xpEarned: totalEarnedXP,
        wasSuccessful: true,
      };

      const updatedHistory = [newHistoryItem, ...history];
      setStats(updatedStats);
      setHistory(updatedHistory);
      setTrainingState('RSLT');
      saveData(updatedStats, updatedHistory);
    } else {
      const updatedStats: UserStats = {
        ...stats,
        currentStreak: 0,
      };
      setStats(updatedStats);
      setTrainingState('FAIL');
      saveData(updatedStats, history);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active' && trainingState === 'WAIT') {
      triggerMockAppOpen();
    }
    appStateRef.current = nextAppState;
  };

  const resetToIdle = () => {
    setTrainingState('HOME');
  };

  return {
    trainingState,
    setTrainingState,
    stats,
    history,
    lastElapsedTime,
    startTrainingSequence,
    triggerMockAppOpen,
    executeCloseRep,
    resetToIdle,
  };
};