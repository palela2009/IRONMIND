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
    desc: 'Reach level 10',
    glyph: '♛',
    color: '#FFD700',
    earned: (s) => s.level >= 10,
  },
  {
    id: 'machine',
    name: 'MACHINE',
    desc: 'Complete 100 challenges',
    glyph: '⬣',
    color: '#B14CFF',
    earned: (s) => s.totalChallenges >= 100,
  },
  {
    id: 'relentless',
    name: 'RELENTLESS',
    desc: 'Win 15 challenges in a row',
    glyph: '☠',
    color: '#FF3B6B',
    earned: (s) => s.longestStreak >= 15,
  },
  {
    id: 'centurion',
    name: 'CENTURION',
    desc: 'Complete 30 challenges',
    glyph: '⬢',
    color: '#7A9BFF',
    earned: (s) => s.totalChallenges >= 30,
  },
  {
    id: 'flawless',
    name: 'FLAWLESS',
    desc: '70% success over 15+ challenges',
    glyph: '✦',
    color: '#3FD8C8',
    earned: (s) => s.totalChallenges >= 15 && successRate(s) >= 0.7,
  },
  {
    id: 'unbroken',
    name: 'UNBROKEN',
    desc: 'Win 7 challenges in a row',
    glyph: '⛓',
    color: '#FF8A3B',
    earned: (s) => s.longestStreak >= 7,
  },
  {
    id: 'quickdraw',
    name: 'QUICKDRAW',
    desc: 'Exit in under 2.5 seconds',
    glyph: '⚡',
    color: '#38BDF8',
    earned: (s) => s.bestReactionTime > 0 && s.bestReactionTime < 2.5,
  },
];

export const earnedBadges = (s: UserStats, unlockAll = false): Badge[] =>
  unlockAll ? ELITE_BADGES : ELITE_BADGES.filter((b) => b.earned(s));

export const topBadgeFor = (s: UserStats, isPro: boolean, unlockAll = false): Badge | null => {
  if (unlockAll) return ELITE_BADGES[0];
  return isPro ? ELITE_BADGES.find((b) => b.earned(s)) ?? null : null;
};
