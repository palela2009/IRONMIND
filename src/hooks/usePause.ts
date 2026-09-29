import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

const { UsageMonitor } = NativeModules;

export type PauseOption = 'hour' | 'fourHours' | 'tomorrow';

export const PAUSE_OPTIONS: { id: PauseOption; label: string }[] = [
  { id: 'hour', label: '1 HOUR' },
  { id: 'fourHours', label: '4 HOURS' },
  { id: 'tomorrow', label: 'UNTIL TOMORROW' },
];

// Module-level rather than per-component, so the Profile control and the Home banner are
// always reading the same value. Two independent copies would drift the moment one of them
// paused or resumed.
let pausedUntil = 0;
const listeners = new Set<(v: number) => void>();

const publish = (v: number) => {
  pausedUntil = v;
  listeners.forEach((l) => l(v));
};

const untilFor = (option: PauseOption): number => {
  const now = Date.now();
  if (option === 'hour') return now + 60 * 60 * 1000;
  if (option === 'fourHours') return now + 4 * 60 * 60 * 1000;
  // Local midnight rather than now + 24h, so pausing for an evening exam at 21:00 resumes the
  // next morning instead of silently leaving the whole of the next day unmonitored.
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime();
};

const nativeAvailable = () => Platform.OS === 'android' && !!UsageMonitor?.setPausedUntil;

export const pauseMonitoring = async (option: PauseOption): Promise<void> => {
  const until = untilFor(option);
  if (nativeAvailable()) UsageMonitor.setPausedUntil(until);
  publish(until);
};

export const resumeMonitoring = async (): Promise<void> => {
  if (nativeAvailable()) UsageMonitor.setPausedUntil(0);
  publish(0);
};

export const refreshPause = async (): Promise<void> => {
  if (!nativeAvailable()) return;
  try {
    const v: number = await UsageMonitor.getPausedUntil();
    publish(v > Date.now() ? v : 0);
  } catch {}
};

export const formatRemaining = (until: number): string => {
  const ms = until - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.max(1, Math.ceil((ms % 3_600_000) / 60_000));
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const usePause = () => {
  const [until, setUntil] = useState(pausedUntil);
  const [, tick] = useState(0);

  useEffect(() => {
    listeners.add(setUntil);
    refreshPause();
    return () => {
      listeners.delete(setUntil);
    };
  }, []);

  // Re-renders the countdown, and clears the pause in the UI once it lapses. The service
  // resumes on its own at the same moment; this only keeps the screen honest about it.
  useEffect(() => {
    if (until <= 0) return;
    const id = setInterval(() => {
      if (Date.now() >= until) publish(0);
      else tick((n) => n + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, [until]);

  const paused = until > Date.now();
  return { paused, until, remaining: paused ? formatRemaining(until) : '' };
};
