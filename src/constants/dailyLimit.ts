export type DailyLimitLevel = 'EASY' | 'MEDIUM' | 'HARD';

// More daily attempts is the "harder" mode — more exposure to monitored apps to slip up on.
export const DAILY_LIMIT_VALUES: Record<DailyLimitLevel, number> = {
  EASY: 3,
  MEDIUM: 5,
  HARD: 10,
};

export const DEFAULT_DAILY_LIMIT: DailyLimitLevel = 'MEDIUM';
