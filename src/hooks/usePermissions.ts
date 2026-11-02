import { useState, useEffect, useCallback } from 'react';
import { AppState, Linking, NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { syncAppMonitor } from './useAppMonitor';

export interface PermissionStatus {
  notifications: boolean;
  usage: boolean;
  battery: boolean;
}

const native = NativeModules.UsageMonitor;

export const isXiaomiFamily = (): boolean => {
  if (Platform.OS !== 'android') return false;
  const maker = String((Platform.constants as any)?.Manufacturer ?? '').toLowerCase();
  return ['xiaomi', 'redmi', 'poco'].some((m) => maker.includes(m));
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

export const usePermissions = () => {
  const [status, setStatus] = useState<PermissionStatus>({ notifications: false, usage: false, battery: false });
  const [monitoring, setMonitoring] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [checked, setChecked] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setStatus(await readStatus());
    setMonitoring(!!(await native?.isMonitoring?.().catch(() => false)));
    setChecked(true);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 5000);
    return () => { sub.remove(); clearInterval(timer); };
  }, [refresh]);

  const requestNotifications = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted' && !current.canAskAgain) {
      await Linking.openSettings();
      return;
    }
    await Notifications.requestPermissionsAsync();
    refresh();
  }, [refresh]);

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
      await refresh();
      if (!(await native?.isMonitoring?.())) setRecoveryError('Monitoring has not started. Check usage access and your selected apps.');
    } catch { setRecoveryError('Could not restart monitoring. Reopen IRONMIND and try again.'); }
    finally { setRecovering(false); }
  }, [refresh]);

  const allGranted = status.notifications && status.usage && status.battery;

  return { status, checked, allGranted, monitoring, recovering, recoveryError, restartMonitoring, refresh, requestNotifications, openUsageAccess, requestBatteryExemption, openAutostart };
};
