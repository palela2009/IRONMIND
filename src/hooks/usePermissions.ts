import { useState, useEffect, useCallback } from 'react';
import { AppState, Linking, NativeModules, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

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
  const { status } = await Notifications.getPermissionsAsync();
  let usage = true;
  let battery = true;
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
  const [checked, setChecked] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    setStatus(await readStatus());
    setChecked(true);
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
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

  const allGranted = status.notifications && status.usage && status.battery;

  return { status, checked, allGranted, refresh, requestNotifications, openUsageAccess, requestBatteryExemption, openAutostart };
};
