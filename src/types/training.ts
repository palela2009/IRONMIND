export type TrainingState = 'HOME' | 'ARM' | 'WAIT' | 'REP' | 'RSLT' | 'FAIL' | 'STATS' | 'PROFILE';

export interface RepHistoryItem {
  id: string;
  targetApp: string;
  elapsedTime: number;
  timestamp: number;
  xpEarned: number;
  wasSuccessful: boolean;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  bestReactionTime: number;
  totalReps: number;
  currentXP: number;
  level: number;
}