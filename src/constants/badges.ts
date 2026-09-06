import { UserStats } from '../types/training';

export interface Badge {
  id: string;
  name: string;
  desc: string;
  glyph: string;
  color: string;
  earned: (s: UserStats) => boolean;
}

const successRate = (s: UserStats): number =>
  s.totalChallenges > 0 ? s.successCount / s.totalChallenges : 0;

export const ELITE_BADGES: Badge[] = [
  {
    id: 'ascendant',
    name: 'ASCENDANT',
    desc: 'Reach level 20',
    glyph: '♛',
    color: '#FFD700',
    earned: (s) => s.level >= 20,
  },
  {
    id: 'machine',
    name: 'MACHINE',
    desc: 'Complete 150 challenges',
    glyph: '⬣',
    color: '#B14CFF',
    earned: (s) => s.totalChallenges >= 150,
  },
  {
    id: 'relentless',
    name: 'RELENTLESS',
    desc: 'Win 25 challenges in a row',
    glyph: '☠',
    color: '#FF3B6B',
    earned: (s) => s.longestStreak >= 25,
  },
  {
    id: 'centurion',
    name: 'CENTURION',
    desc: 'Complete 50 challenges',
    glyph: '⬢',
    color: '#7A9BFF',
    earned: (s) => s.totalChallenges >= 50,
  },
  {
    id: 'flawless',
    name: 'FLAWLESS',
    desc: '75% success over 20+ challenges',
    glyph: '✦',
    color: '#3FD8C8',
    earned: (s) => s.totalChallenges >= 20 && successRate(s) >= 0.75,
  },
  {
    id: 'unbroken',
    name: 'UNBROKEN',
    desc: 'Win 10 challenges in a row',
    glyph: '⛓',
    color: '#FF8A3B',
    earned: (s) => s.longestStreak >= 10,
  },
  {
    id: 'quickdraw',
    name: 'QUICKDRAW',
    desc: 'Exit in under 2 seconds',
    glyph: '⚡',
    color: '#38BDF8',
    earned: (s) => s.bestReactionTime > 0 && s.bestReactionTime < 2.0,
  },
];

export const earnedBadges = (s: UserStats, unlockAll = false): Badge[] =>
  unlockAll ? ELITE_BADGES : ELITE_BADGES.filter((b) => b.earned(s));

export const topBadgeFor = (s: UserStats, isPro: boolean, unlockAll = false): Badge | null => {
  if (unlockAll) return ELITE_BADGES[0];
  return isPro ? ELITE_BADGES.find((b) => b.earned(s)) ?? null : null;
};
