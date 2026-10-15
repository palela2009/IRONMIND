import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { usePermissions, isXiaomiFamily } from '../hooks/usePermissions';

type Perms = ReturnType<typeof usePermissions>;

interface Props {
  perms: Perms;
}

export const PermissionSteps: React.FC<Props> = ({ perms }) => {
  const styles = useThemedStyles(makeStyles);
  const { status, requestNotifications, openUsageAccess, requestBatteryExemption, openAutostart } = perms;

  const steps = [
    {
      key: 'notifications',
      title: 'NOTIFICATIONS',
      done: status.notifications,
      desc: 'Challenges arrive as alerts. Without this you will never see one.',
      doneDesc: 'Allowed. Challenges will reach you.',
      action: 'ALLOW NOTIFICATIONS →',
      onPress: requestNotifications,
    },
    {
      key: 'usage',
      title: 'USAGE ACCESS',
      done: status.usage,
      desc: 'Lets IRONMIND see which app is open so it knows when to fire. Find IRONMIND in the list and switch it on.',
      doneDesc: 'On. IRONMIND can see when you open a tracked app.',
      action: 'OPEN USAGE ACCESS →',
      onPress: openUsageAccess,
    },
    {
      key: 'battery',
      title: 'BATTERY OPTIMIZATION OFF',
      done: status.battery,
      desc: 'Stops your phone from killing IRONMIND in the background. Tap Allow on the next screen.',
      doneDesc: 'Off. IRONMIND keeps running in the background.',
      action: 'TURN OFF OPTIMIZATION →',
      onPress: requestBatteryExemption,
    },
  ];

  return (
    <View>
      {steps.map((s, i) => (
        <View key={s.key} style={[styles.card, s.done && styles.cardDone]}>
          <View style={styles.head}>
            <View style={[styles.num, s.done && styles.numDone]}>
              <Text style={[styles.numText, s.done && styles.numTextDone]}>{s.done ? '✓' : String(i + 1)}</Text>
            </View>
            <Text style={styles.title}>{s.title}</Text>
            {s.done && <Text style={styles.on}>ON</Text>}
          </View>
          <Text style={styles.desc}>{s.done ? s.doneDesc : s.desc}</Text>
          {!s.done && (
            <TouchableOpacity style={styles.btn} onPress={s.onPress} activeOpacity={0.85}>
              <Text style={styles.btnText}>{s.action}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {isXiaomiFamily() && (
        <View style={[styles.card, styles.cardNote]}>
          <Text style={styles.noteTitle}>XIAOMI · REDMI · POCO</Text>
          <Text style={styles.desc}>
            These phones also block apps from starting on their own. Open Autostart and switch IRONMIND on,
            or challenges stop after a while.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={openAutostart} activeOpacity={0.85}>
            <Text style={styles.btnText}>OPEN AUTOSTART →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardDone: { borderColor: c.accent, backgroundColor: c.accentMuted },
  cardNote: { borderLeftWidth: 3, borderLeftColor: c.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  numDone: { backgroundColor: c.accent },
  numText: { color: c.textSecondary, fontSize: 12, fontWeight: '900' },
  numTextDone: { color: c.accentContrast },
  title: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  on: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  desc: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  btn: { backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: c.accentContrast, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  noteTitle: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.sm },
});
