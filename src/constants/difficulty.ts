export type DifficultyLevel = 'EASY' | 'INTERMEDIATE' | 'HARD';

export const DIFFICULTY_WINDOW_SECONDS: Record<DifficultyLevel, number> = {
  EASY: 10,
  INTERMEDIATE: 5,
  HARD: 3,
};

export const DEFAULT_DIFFICULTY: DifficultyLevel = 'EASY';
