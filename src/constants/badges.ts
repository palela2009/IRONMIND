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
    desc: 'Reach level 50',
    glyph: '♛',
    color: '#FFD700',
    earned: (s) => s.level >= 50,
  },
  {
    id: 'machine',
    name: 'MACHINE',
    desc: 'Complete 1000 challenges',
    glyph: '⬣',
    color: '#B14CFF',
    earned: (s) => s.totalChallenges >= 1000,
  },
  {
    id: 'relentless',
    name: 'RELENTLESS',
    desc: 'Win 100 challenges in a row',
    glyph: '☠',
    color: '#FF3B6B',
    earned: (s) => s.longestStreak >= 100,
  },
  {
    id: 'phantom',
    name: 'PHANTOM',
    desc: 'Exit in under half a second',
    glyph: '◆',
    color: '#38BDF8',
    earned: (s) => s.bestReactionTime > 0 && s.bestReactionTime < 0.5,
  },
  {
    id: 'flawless',
    name: 'FLAWLESS',
    desc: '90% success rate over 100+ challenges',
    glyph: '✦',
    color: '#3FD8C8',
    earned: (s) => s.totalChallenges >= 100 && successRate(s) >= 0.9,
  },
  {
    id: 'unbroken',
    name: 'UNBROKEN',
    desc: 'Win 50 challenges in a row',
    glyph: '⛓',
    color: '#FF8A3B',
    earned: (s) => s.longestStreak >= 50,
  },
  {
    id: 'centurion',
    name: 'CENTURION',
    desc: 'Complete 250 challenges',
    glyph: '⬢',
    color: '#7A9BFF',
    earned: (s) => s.totalChallenges >= 250,
  },
];

export const earnedBadges = (s: UserStats): Badge[] => ELITE_BADGES.filter((b) => b.earned(s));

export const topBadgeFor = (s: UserStats, isPro: boolean): Badge | null =>
  isPro ? ELITE_BADGES.find((b) => b.earned(s)) ?? null : null;
