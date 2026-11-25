import { useState, useEffect, useCallback } from 'react';
import { AppState, Linking, NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { syncAppMonitor } from './useAppMonitor';

export interface PermissionStatus {
  notifications: boolean;
  usage: boolean;
  battery: boolean;
}

export type DeviceBrand = 'samsung' | 'xiaomi' | 'oneplus' | 'pixel' | 'other';

const native = NativeModules.UsageMonitor;

export const getDeviceBrand = (): DeviceBrand => {
  if (Platform.OS !== 'android') return 'other';
  const maker = String((Platform.constants as any)?.Manufacturer ?? '').toLowerCase();
  const brand = String((Platform.constants as any)?.Brand ?? '').toLowerCase();
  const combined = `${maker} ${brand}`;
  if (combined.includes('samsung')) return 'samsung';
  if (['xiaomi', 'redmi', 'poco'].some((m) => combined.includes(m))) return 'xiaomi';
  if (['oneplus', 'oppo', 'realme'].some((m) => combined.includes(m))) return 'oneplus';
  if (combined.includes('google') || combined.includes('pixel')) return 'pixel';
  return 'other';
};

export const isXiaomiFamily = (): boolean => getDeviceBrand() === 'xiaomi';

interface PermissionStore {
  status: PermissionStatus;
  monitoring: boolean;
  checked: boolean;
}

const initialStore: PermissionStore = {
  status: { notifications: false, usage: false, battery: false },
  monitoring: false,
  checked: false,
};

let store: PermissionStore = initialStore;
const listeners = new Set<(state: PermissionStore) => void>();
let activeSubscribers = 0;
let appStateSub: { remove: () => void } | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight: Promise<void> | null = null;

const publish = (next: PermissionStore) => {
  store = next;
  listeners.forEach((listener) => listener(store));
};

const readStatus = async (): Promise<PermissionStatus> => {
  const { status } = await Notifications.getPermissionsAsync().catch(() => ({ status: 'denied' }));
  let usage = Platform.OS !== 'android';
  let battery = Platform.OS !== 'android';
  if (Platform.OS === 'android' && native) {
    try {
      usage = !!(await native.hasUsageAccess());
    } catch {
      usage = false;
    }
    try {
      battery = !!(await native.isIgnoringBatteryOptimizations());
    } catch {
      battery = false;
    }
  }
  return { notifications: status === 'granted', usage, battery };
};

export const refreshPermissions = (): Promise<void> => {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const status = await readStatus();
    const monitoring = !!(await native?.isMonitoring?.().catch(() => false));
    publish({ status, monitoring, checked: true });
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

const startSharedWatch = () => {
  activeSubscribers += 1;
  if (activeSubscribers > 1) return;
  void refreshPermissions();
  appStateSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshPermissions();
  });
  pollTimer = setInterval(() => {
    if (AppState.currentState === 'active') void refreshPermissions();
  }, 5000);
};

const stopSharedWatch = () => {
  activeSubscribers = Math.max(0, activeSubscribers - 1);
  if (activeSubscribers > 0) return;
  appStateSub?.remove();
  appStateSub = null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

export const usePermissions = () => {
  const [state, setState] = useState<PermissionStore>(store);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    listeners.add(setState);
    startSharedWatch();
    return () => {
      listeners.delete(setState);
      stopSharedWatch();
    };
  }, []);

  const refresh = useCallback(() => refreshPermissions(), []);

  const requestNotifications = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted' && !current.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await Notifications.requestPermissionsAsync();
    await refreshPermissions();
  }, []);

  const openUsageAccess = useCallback(async () => {
    try {
      if (Platform.OS === 'android') await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
      else await Linking.openSettings();
    } catch {
      await Linking.openSettings();
    }
  }, []);

  const requestBatteryExemption = useCallback(() => {
    if (Platform.OS === 'android' && native) native.requestIgnoreBatteryOptimizations();
  }, []);

  const openAutostart = useCallback(async () => {
    let opened = false;
    try {
      opened = !!(await native?.openAutostartSettings());
    } catch {}
    if (!opened) await Linking.openSettings();
  }, []);

  const restartMonitoring = useCallback(async () => {
    setRecovering(true);
    setRecoveryError('');
    try {
      await syncAppMonitor();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await refreshPermissions();
      if (!(await native?.isMonitoring?.())) {
        setRecoveryError('Monitoring has not started. Check Usage Access and make sure at least one app is selected.');
      }
    } catch {
      setRecoveryError('Could not restart monitoring. Reopen IRONMIND and try again.');
    } finally {
      setRecovering(false);
    }
  }, []);

  const coreGranted = state.status.notifications && state.status.usage;
  const allGranted = coreGranted;
  const allOptimal = coreGranted && state.status.battery;
  const batteryRecommended = !state.status.battery;

  return {
    status: state.status,
    checked: state.checked,
    coreGranted,
    allGranted,
    allOptimal,
    batteryRecommended,
    monitoring: state.monitoring,
    recovering,
    recoveryError,
    restartMonitoring,
    refresh,
    requestNotifications,
    openUsageAccess,
    requestBatteryExemption,
    openAutostart,
  };
};
