import { ChallengeItem, UserStats } from '../types/training';
import { challengeDay, deviceTimeZone } from './challengeTime';
import { RejectedChallenge } from './progressQueue';

export const INITIAL_STATS: UserStats = { currentStreak: 0, longestStreak: 0, bestReactionTime: 0, totalChallenges: 0, successCount: 0, currentXP: 0, level: 1 };

export interface ProgressSnapshot {
  stats: UserStats & { lostStreak?: number; reclaimableEventId?: string | null };
  history: ChallengeItem[];
  streakFreezes: number;
  pending: ChallengeItem[];
  rejected?: RejectedChallenge[];
  timeZone?: string;
}

export const EMPTY_PROGRESS: ProgressSnapshot = { stats: INITIAL_STATS, history: [], streakFreezes: 0, pending: [] };

export function mergeHistory(local: ChallengeItem[], cloud: ChallengeItem[]): ChallengeItem[] {
  const items = new Map(local.map((item) => [`${item.targetApp}:${item.timestamp}`, item]));
  for (const item of cloud) items.set(`${item.targetApp}:${item.timestamp}`, item);
  return [...items.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export function projectProgress(snapshot: ProgressSnapshot, dailyLimit: number) {
  const stats = { ...snapshot.stats };
  const timeZone = snapshot.timeZone ?? deviceTimeZone();
  let freezes = snapshot.streakFreezes;
  const counts = new Map<string, number>();
  for (const item of snapshot.history) {
    if (item.counted === false || !Number.isFinite(item.timestamp) || !Number.isFinite(new Date(item.timestamp).getTime())) continue;
    const day = challengeDay(item.timestamp, timeZone);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const pending = snapshot.pending.filter((item) => Number.isFinite(item.timestamp) && Number.isFinite(new Date(item.timestamp).getTime())).map((item) => {
    const day = challengeDay(item.timestamp, timeZone);
    const count = counts.get(day) ?? 0;
    counts.set(day, count + 1);
    if (count >= dailyLimit) return { ...item, counted: false };
    const freezeUsed = !item.wasSuccessful && stats.currentStreak > 0 && freezes > 0;
    if (freezeUsed) freezes -= 1;
    stats.lostStreak = !item.wasSuccessful && !freezeUsed ? stats.currentStreak : 0;
    stats.reclaimableEventId = stats.lostStreak > 0 ? item.id : null;
    stats.currentXP += item.wasSuccessful ? 50 + (stats.currentStreak >= 5 ? 10 : 0) : 0;
    stats.currentStreak = item.wasSuccessful ? stats.currentStreak + 1 : freezeUsed ? stats.currentStreak : 0;
    stats.longestStreak = Math.max(stats.longestStreak, stats.currentStreak);
    if (item.wasSuccessful && item.elapsedTime > 0) stats.bestReactionTime = stats.bestReactionTime > 0 ? Math.min(stats.bestReactionTime, item.elapsedTime) : item.elapsedTime;
    stats.totalChallenges += 1;
    stats.successCount += item.wasSuccessful ? 1 : 0;
    stats.level = Math.floor(stats.currentXP / 200) + 1;
    return { ...item, freezeUsed, counted: true };
  });
  return { stats, history: mergeHistory(snapshot.history, pending), streakFreezes: freezes };
}
