import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

const cache: Record<string, string | null> = {};
const listeners = new Set<() => void>();
const pending = new Set<string>();

const load = async (names: string[]) => {
  const missing = names.filter((n) => !(n in cache) && !pending.has(n));
  if (!missing.length || Platform.OS !== 'android' || !NativeModules.UsageMonitor?.getAppIcons) return;
  missing.forEach((n) => pending.add(n));
  try {
    const icons: Record<string, string> = await NativeModules.UsageMonitor.getAppIcons(missing);
    missing.forEach((n) => {
      cache[n] = icons[n] ?? null;
    });
  } catch {
    missing.forEach((n) => {
      cache[n] = null;
    });
  }
  missing.forEach((n) => pending.delete(n));
  listeners.forEach((l) => l());
};

export const useAppIcon = (app: string): string | null => {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    load([app]);
    return () => {
      listeners.delete(listener);
    };
  }, [app]);

  return cache[app] ?? null;
};
