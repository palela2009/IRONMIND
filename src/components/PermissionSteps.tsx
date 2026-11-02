import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { usePermissions, isXiaomiFamily } from '../hooks/usePermissions';
import { appAlert } from './AppDialog';

type Perms = ReturnType<typeof usePermissions>;

interface Props {
  perms: Perms;
}

export const PermissionSteps: React.FC<Props> = ({ perms }) => {
  const styles = useThemedStyles(makeStyles);
  const { status, requestNotifications, openUsageAccess, requestBatteryExemption, openAutostart } = perms;
  const xiaomi = isXiaomiFamily();

  const startUsageAccess = () => {
    appAlert(
      xiaomi ? 'Your phone will show a red warning' : 'Before you switch it on',
      xiaomi
        ? 'Xiaomi, Redmi and POCO show a red "Danger" screen for every app that asks for Usage access. It is a standard system message, not a virus alert.\n\n1. Find IRONMIND and switch it on\n2. Wait for the 10 second timer\n3. Tick "I\'m aware of the possible risks"\n4. Tap OK\n\nIRONMIND only reads which app is open and for how many minutes. It never sees your messages, photos, passwords or anything you type.'
        : 'IRONMIND only reads which app is open and for how many minutes. It never sees your messages, photos, passwords or anything you type.\n\nFind IRONMIND in the list and switch it on.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: openUsageAccess },
      ]
    );
  };

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
      desc: xiaomi
        ? 'Lets IRONMIND see which app is open. Your phone will show a red warning screen: that is normal for this setting, wait 10 seconds, tick the box and tap OK.'
        : 'Lets IRONMIND see which app is open so it knows when to fire. Find IRONMIND in the list and switch it on.',
      doneDesc: 'On. IRONMIND can see when you open a tracked app.',
      action: 'OPEN USAGE ACCESS →',
      onPress: startUsageAccess,
    },
    {
      key: 'battery',
      title: 'BATTERY OPTIMIZATION OFF',
      done: status.battery,
      desc: 'Helps IRONMIND keep monitoring while you use other apps. Tap Allow on the next screen.',
      doneDesc: 'Allowed. Background monitoring is less likely to be interrupted.',
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
            <Text style={styles.on}>{s.done ? 'READY' : 'NEEDED'}</Text>
          </View>
          <Text style={styles.desc}>{s.done ? s.doneDesc : s.desc}</Text>
          {!s.done && (
            <TouchableOpacity style={styles.btn} onPress={s.onPress} activeOpacity={0.85}>
              <Text style={styles.btnText}>{s.action}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>🔒 WHAT IRONMIND CAN SEE</Text>
        <Text style={styles.privacyText}>
          Which app is open and how many minutes you spend in it. Never your messages, photos, passwords or
          anything you type.
        </Text>
      </View>

      {xiaomi && (
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
  privacy: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md, marginBottom: spacing.md },
  privacyTitle: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  privacyText: { color: c.textTertiary, fontSize: 11, lineHeight: 16 },
  noteTitle: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.sm },
});
