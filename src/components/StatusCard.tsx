import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, AppState, NativeModules } from 'react-native';
import * as Notifications from 'expo-notifications';
import { radius, spacing, Palette } from '../theme';
import { useThemedStyles } from '../context/ThemeContext';

export const StatusCard: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const [notifGranted, setNotifGranted] = useState(false);
  const [usageAccessGranted, setUsageAccessGranted] = useState(false);
  const [batteryExempt, setBatteryExempt] = useState(false);

  const checkPermissions = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotifGranted(status === 'granted');

    if (Platform.OS === 'android' && NativeModules.UsageMonitor) {
      try {
        setUsageAccessGranted(!!(await NativeModules.UsageMonitor.hasUsageAccess()));
      } catch {
        setUsageAccessGranted(false);
      }
      try {
        setBatteryExempt(!!(await NativeModules.UsageMonitor.isIgnoringBatteryOptimizations()));
      } catch {
        setBatteryExempt(false);
      }
    }
  }, []);

  useEffect(() => {
    checkPermissions();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermissions();
    });
    return () => sub.remove();
  }, [checkPermissions]);

  const requestNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifGranted(status === 'granted');
  };

  const openUsageAccess = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings();
    }
  };

  const requestBatteryExemption = () => {
    if (Platform.OS === 'android' && NativeModules.UsageMonitor) {
      NativeModules.UsageMonitor.requestIgnoreBatteryOptimizations();
    }
  };

  const rows = [
    { label: 'Notifications', ok: notifGranted, okText: 'ALLOWED', fixText: 'ENABLE →', onFix: requestNotifications },
    { label: 'Usage Access', ok: usageAccessGranted, okText: 'ON', fixText: 'TURN ON →', onFix: openUsageAccess },
    { label: 'Battery Optimization', ok: batteryExempt, okText: 'OFF', fixText: 'TURN OFF →', onFix: requestBatteryExemption },
  ];

  const allOk = rows.every((r) => r.ok);

  return (
    <>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.label}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.row}>
              <View style={styles.left}>
                <View style={[styles.dot, row.ok && styles.dotOn]} />
                <Text style={styles.label}>{row.label}</Text>
              </View>
              {row.ok ? (
                <Text style={styles.ok}>{row.okText}</Text>
              ) : (
                <TouchableOpacity onPress={row.onFix} activeOpacity={0.8}>
                  <Text style={styles.fix}>{row.fixText}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>

      {!allOk && (
        <Text style={styles.hint}>
          IRONMIND needs these to detect when you open a monitored app. Some phones
          (especially Xiaomi/MIUI) kill the background monitor to save battery, which breaks
          challenge detection entirely.
        </Text>
      )}
    </>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  divider: { height: 1, backgroundColor: c.borderSubtle },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  dotOn: { backgroundColor: c.accent },
  label: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
  ok: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  fix: { color: c.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  hint: {
    color: c.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
});
