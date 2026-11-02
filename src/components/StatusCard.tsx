import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { radius, spacing, Palette } from '../theme';
import { useThemedStyles } from '../context/ThemeContext';
import { usePermissions, isXiaomiFamily } from '../hooks/usePermissions';

export const StatusCard: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const { status, allGranted, monitoring, recovering, restartMonitoring, requestNotifications, openUsageAccess, requestBatteryExemption, openAutostart } = usePermissions();

  const rows = [
    { label: 'Background monitor', ok: monitoring, okText: 'RUNNING', fixText: recovering ? 'STARTING...' : 'RESTART >', onFix: restartMonitoring },
    { label: 'Notifications', ok: status.notifications, okText: 'ALLOWED', fixText: 'ENABLE →', onFix: requestNotifications },
    { label: 'Usage Access', ok: status.usage, okText: 'ON', fixText: 'TURN ON →', onFix: openUsageAccess },
    { label: 'Battery Optimization', ok: status.battery, okText: 'OFF', fixText: 'TURN OFF →', onFix: requestBatteryExemption },
  ];

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
        {isXiaomiFamily() && (
          <View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.left}>
                <View style={[styles.dot, styles.dotNeutral]} />
                <Text style={styles.label}>Autostart (Xiaomi)</Text>
              </View>
              <TouchableOpacity onPress={openAutostart} activeOpacity={0.8}>
                <Text style={styles.fix}>CHECK →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {!allGranted && (
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
  row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.sm, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  divider: { height: 1, backgroundColor: c.borderSubtle },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger },
  dotOn: { backgroundColor: c.accent },
  dotNeutral: { backgroundColor: c.textFaint },
  label: { color: c.textPrimary, fontSize: 13, fontWeight: '700', flexShrink: 1 },
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
