import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { usePermissions, isXiaomiFamily, getDeviceBrand } from '../hooks/usePermissions';
import { appAlert } from './AppDialog';
import type { ShortVideoController } from '../hooks/useInstagramReelsTest';

type Perms = ReturnType<typeof usePermissions>;

interface Props {
  perms: Perms;
  reelsTest?: ShortVideoController | null;
  showOptionalTips?: boolean;
}

const scrollPathHint = () => {
  const brand = getDeviceBrand();
  if (brand === 'samsung') return 'Tap Installed apps → IRONMIND — Scroll Detection → ON.';
  if (brand === 'xiaomi' || brand === 'oneplus') return 'Tap Downloaded apps → IRONMIND — Scroll Detection → ON.';
  return 'Find IRONMIND — Scroll Detection under Downloaded apps → ON.';
};

export const PermissionSteps: React.FC<Props> = ({ perms, reelsTest, showOptionalTips = true }) => {
  const styles = useThemedStyles(makeStyles);
  const { status, requestNotifications, openUsageAccess, requestBatteryExemption, openAutostart } = perms;
  const xiaomi = isXiaomiFamily();

  const startUsageAccess = () => {
    appAlert(
      xiaomi ? 'Your phone will show a red warning' : 'Quick tip before Settings opens',
      xiaomi
        ? 'Xiaomi, Redmi and POCO show a red "Danger" screen for every app asking for Usage Access. That is a normal Android prompt.\n\n1. Find IRONMIND and switch it ON\n2. Wait for the 10-second timer\n3. Tick "I\'m aware of the possible risks"\n4. Tap OK\n\nIRONMIND only sees which app is open and for how long — never your messages, photos, or passwords.'
        : 'Find IRONMIND in the list and switch it ON.\n\nIRONMIND only reads which app is open and for how many minutes — never your messages, photos, passwords, or anything you type.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: openUsageAccess },
      ]
    );
  };

  const steps = [
    {
      key: 'notifications',
      title: 'NOTIFICATIONS',
      done: status.notifications,
      desc: 'One tap. Lets IRONMIND send scroll challenges and duel alerts.',
      doneDesc: 'Ready. Challenges will reach you instantly.',
      action: 'ALLOW NOTIFICATIONS →',
      onPress: requestNotifications,
    },
    {
      key: 'usage',
      title: 'USAGE ACCESS',
      done: status.usage,
      desc: xiaomi
        ? 'Powers all-apps Screen Time, Leaderboard & automatic duel sync. (Wait 10s on Xiaomi prompt & tap OK.)'
        : 'Powers all-apps Screen Time, Leaderboard & automatic background duel sync.',
      doneDesc: 'Ready. Screen time & background duel sync are active.',
      action: 'OPEN USAGE ACCESS →',
      onPress: startUsageAccess,
    },
    ...(reelsTest
      ? [
          {
            key: 'scroll',
            title: 'SCROLL CHALLENGES',
            done: reelsTest.isActive,
            desc: `Detects doomscrolling on Reels, TikTok, Shorts & Spotlight — silent during DMs & YouTube study. ${scrollPathHint()}`,
            doneDesc: 'Ready. Scroll-only challenges are active for all 5 apps.',
            action: reelsTest.needsSetup ? 'FINISH SCROLL SETUP →' : 'TURN ON SCROLL CHALLENGES →',
            onPress: reelsTest.openGuide,
          },
        ]
      : []),
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
            <View style={[styles.statusBadge, s.done ? styles.statusReady : styles.statusNeeded]}>
              <Text style={[styles.statusText, s.done ? styles.statusTextReady : styles.statusTextNeeded]}>
                {s.done ? 'READY' : 'NEEDED'}
              </Text>
            </View>
          </View>
          <Text style={styles.desc}>{s.done ? s.doneDesc : s.desc}</Text>
          {!s.done && (
            <TouchableOpacity style={styles.btn} onPress={s.onPress} activeOpacity={0.85}>
              <Text style={styles.btnText}>{s.action}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      {showOptionalTips && !status.battery && (
        <TouchableOpacity style={styles.optionalRow} onPress={requestBatteryExemption} activeOpacity={0.85}>
          <View style={styles.optionalBody}>
            <Text style={styles.optionalKicker}>OPTIONAL · 1-TAP RELIABILITY</Text>
            <Text style={styles.optionalTitle}>Unrestricted battery</Text>
            <Text style={styles.optionalDesc}>Prevents Android from sleeping IRONMIND overnight.</Text>
          </View>
          <Text style={styles.optionalCta}>ALLOW →</Text>
        </TouchableOpacity>
      )}

      {showOptionalTips && xiaomi && (
        <TouchableOpacity style={styles.optionalRow} onPress={openAutostart} activeOpacity={0.85}>
          <View style={styles.optionalBody}>
            <Text style={styles.optionalKicker}>OPTIONAL · XIAOMI / REDMI / POCO</Text>
            <Text style={styles.optionalTitle}>Autostart</Text>
            <Text style={styles.optionalDesc}>Keeps monitoring alive after a reboot on MIUI / HyperOS.</Text>
          </View>
          <Text style={styles.optionalCta}>OPEN →</Text>
        </TouchableOpacity>
      )}

      <View style={styles.privacy}>
        <Text style={styles.privacyTitle}>🔒 PRIVACY FIRST</Text>
        <Text style={styles.privacyText}>
          Everything stays on your phone. IRONMIND never reads your messages, snaps, photos, passwords, or anything you type.
        </Text>
      </View>
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
  cardDone: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  numDone: { backgroundColor: c.accent },
  numText: { color: c.textSecondary, fontSize: 12, fontWeight: '900' },
  numTextDone: { color: c.accentContrast },
  title: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  statusReady: { backgroundColor: c.accentMuted },
  statusNeeded: { backgroundColor: c.dangerMuted },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  statusTextReady: { color: c.accent },
  statusTextNeeded: { color: c.danger },
  desc: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  btn: { backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md },
  btnText: { color: c.accentContrast, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },

  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionalBody: { flex: 1 },
  optionalKicker: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  optionalTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '800', marginTop: 2 },
  optionalDesc: { color: c.textTertiary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  optionalCta: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  privacy: { paddingHorizontal: spacing.xs, paddingVertical: spacing.md, marginTop: spacing.xs },
  privacyTitle: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  privacyText: { color: c.textTertiary, fontSize: 11, lineHeight: 16 },
});
