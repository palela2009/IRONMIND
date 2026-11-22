export type TrainingState = 'HOME' | 'APPS' | 'FRIENDS' | 'PROFILE';

export interface ChallengeItem {
  id: string;
  targetApp: string;
  challengeKind?: 'instagram_reels' | 'facebook_reels' | 'tiktok_feed' | 'youtube_shorts';
  elapsedTime: number;
  timestamp: number;
  wasSuccessful: boolean;
  counted?: boolean;
  freezeUsed?: boolean;
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
