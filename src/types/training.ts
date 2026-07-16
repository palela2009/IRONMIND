export type TrainingState = 'HOME' | 'APPS' | 'FRIENDS' | 'PROFILE';

export interface ChallengeItem {
  id: string;
  targetApp: string;
  elapsedTime: number;
  timestamp: number;
  wasSuccessful: boolean;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  bestReactionTime: number;
  totalChallenges: number;
  successCount: number;
  currentXP: number;
  level: number;
}
