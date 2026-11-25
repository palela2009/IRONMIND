import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { radius, spacing, Palette } from '../theme';
import { useThemedStyles } from '../context/ThemeContext';
import { usePermissions, isXiaomiFamily } from '../hooks/usePermissions';

export const StatusCard: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const {
    status,
    coreGranted,
    monitoring,
    recovering,
    recoveryError,
    restartMonitoring,
    requestNotifications,
    openUsageAccess,
    requestBatteryExemption,
    openAutostart,
  } = usePermissions();

  const rows = [
    {
      label: 'Background monitor',
      ok: monitoring,
      optional: false,
      disabled: recovering,
      okText: 'RUNNING',
      fixText: recovering ? 'STARTING...' : 'RESTART →',
      onFix: restartMonitoring,
    },
    {
      label: 'Notifications',
      ok: status.notifications,
      optional: false,
      disabled: false,
      okText: 'READY',
      fixText: 'ALLOW →',
      onFix: requestNotifications,
    },
    {
      label: 'Usage Access',
      ok: status.usage,
      optional: false,
      disabled: false,
      okText: 'READY',
      fixText: 'TURN ON →',
      onFix: openUsageAccess,
    },
    {
      label: 'Unrestricted battery',
      ok: status.battery,
      optional: true,
      disabled: false,
      okText: 'ON',
      fixText: 'OPTIONAL →',
      onFix: requestBatteryExemption,
    },
  ];

  return (
    <>
      <View style={styles.card}>
        {rows.map((row, i) => (
          <View key={row.label}>
            {i > 0 && <View style={styles.divider} />}
            <View style={styles.row}>
              <View style={styles.left}>
                <View style={[styles.dot, row.ok ? styles.dotOn : row.optional ? styles.dotOptional : styles.dotBad]} />
                <Text style={styles.label}>{row.label}</Text>
              </View>
              {row.ok ? (
                <Text style={styles.ok}>{row.okText}</Text>
              ) : (
                <TouchableOpacity onPress={row.onFix} activeOpacity={0.8} disabled={row.disabled}>
                  <Text style={[styles.fix, row.optional && styles.fixOptional, row.disabled && styles.fixDisabled]}>
                    {row.fixText}
                  </Text>
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
                <View style={[styles.dot, styles.dotOptional]} />
                <Text style={styles.label}>Autostart (Xiaomi)</Text>
              </View>
              <TouchableOpacity onPress={openAutostart} activeOpacity={0.8}>
                <Text style={styles.fixOptional}>CHECK →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {!!recoveryError && <Text style={styles.errorText}>{recoveryError}</Text>}

      {!coreGranted && (
        <Text style={styles.hint}>
          Notifications and Usage Access are needed for challenges and automatic background duel sync.
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: c.accent },
  dotBad: { backgroundColor: c.danger },
  dotOptional: { backgroundColor: '#FFA23B' },
  label: { color: c.textPrimary, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  ok: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  fix: { color: c.danger, fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  fixOptional: { color: c.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  fixDisabled: { opacity: 0.5 },
  errorText: {
    color: c.danger,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  hint: {
    color: c.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
});
