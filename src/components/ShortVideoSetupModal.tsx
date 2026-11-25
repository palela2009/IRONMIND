import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';
import { getDeviceBrand, DeviceBrand } from '../hooks/usePermissions';
import { ShortVideoController } from '../hooks/useInstagramReelsTest';

interface Props {
  controller: ShortVideoController | null;
}

const BRAND_GUIDE: Record<DeviceBrand, { brandLabel: string; steps: string[] }> = {
  samsung: {
    brandLabel: 'SAMSUNG STEPS',
    steps: [
      'Tap "Installed apps" in Accessibility',
      'Find "IRONMIND — Scroll Detection"',
      'Switch it ON, then tap "Allow"',
    ],
  },
  xiaomi: {
    brandLabel: 'XIAOMI / REDMI / POCO STEPS',
    steps: [
      'Tap "Downloaded apps" in Accessibility',
      'Find "IRONMIND — Scroll Detection"',
      'Switch it ON (wait 10s if warned) and tap "OK"',
    ],
  },
  oneplus: {
    brandLabel: 'ONEPLUS / OPPO / REALME STEPS',
    steps: [
      'Tap "Downloaded apps" in Accessibility',
      'Find "IRONMIND — Scroll Detection"',
      'Switch it ON, then tap "Allow"',
    ],
  },
  pixel: {
    brandLabel: 'PIXEL / ANDROID STEPS',
    steps: [
      'Scroll down to "Downloaded apps"',
      'Find "IRONMIND — Scroll Detection"',
      'Switch it ON, then tap "Allow"',
    ],
  },
  other: {
    brandLabel: 'HOW TO FIND IT IN SETTINGS',
    steps: [
      'Open "Installed apps" or "Downloaded apps"',
      'Find "IRONMIND — Scroll Detection"',
      'Switch it ON, then tap "Allow"',
    ],
  },
};

export const ShortVideoSetupModal: React.FC<Props> = ({ controller }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const [busy, setBusy] = useState(false);

  if (!controller) return null;

  const brand = getDeviceBrand();
  const guide = BRAND_GUIDE[brand];
  const { settings } = controller;
  const alreadyConsented = settings.consented && settings.expandedConsented;

  const handlePrimary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (alreadyConsented && !settings.enabled) {
        await controller.openSettingsOnly();
      } else {
        await controller.acceptAndOpenSettings();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTurnOff = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await controller.turnOff();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={controller.guideVisible} animationType="slide" onRequestClose={controller.closeGuide}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>OPTIONAL · 4 APPS</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={controller.closeGuide} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>SCROLL-ONLY{'\n'}DETECTION.</Text>
          <Text style={styles.sub}>
            Catches doomscrolling on Instagram Reels, TikTok, YouTube Shorts and Facebook Reels — while staying completely silent during normal use.
          </Text>

          <View style={styles.rulesCard}>
            <View style={styles.ruleRow}>
              <Text style={styles.ruleGood}>✓</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.ruleBold}>Fires ONLY when scrolling</Text> — after 15+ seconds and 3+ swipes in a short-video feed.
              </Text>
            </View>
            <View style={styles.ruleDivider} />
            <View style={styles.ruleRow}>
              <Text style={styles.ruleQuiet}>✕</Text>
              <Text style={styles.ruleText}>
                <Text style={styles.ruleBold}>Silent for DMs & 1 shared video</Text> — messaging friends, reading comments, or watching a single reel never triggers it.
              </Text>
            </View>
          </View>

          <Text style={styles.section}>{guide.brandLabel}</Text>
          <View style={styles.guideCard}>
            {guide.steps.map((step, idx) => (
              <View key={step} style={[styles.stepRow, idx > 0 && styles.stepSpaced]}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{idx + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <View style={styles.lookForBox}>
              <Text style={styles.lookForLabel}>LOOK FOR THIS ROW IN SETTINGS</Text>
              <View style={styles.mockRow}>
                <View style={styles.mockIcon}>
                  <Text style={styles.mockIconText}>IM</Text>
                </View>
                <View style={styles.mockBody}>
                  <Text style={styles.mockName}>IRONMIND — Scroll Detection</Text>
                  <Text style={styles.mockSub}>Off → Switch On</Text>
                </View>
                <View style={styles.mockSwitch}>
                  <View style={styles.mockKnob} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>🔒 PRIVACY & ACCESSIBILITY DISCLOSURE</Text>
            <Text style={styles.privacyText}>
              IRONMIND uses Android Accessibility solely to recognize short-video feeds (Instagram Reels, Facebook Reels, TikTok, YouTube Shorts) in your tracked apps. Screen labels and swipe activity stay on your phone. IRONMIND never reads messages, captions, passwords, or screenshots. Challenge wins/losses sync to your account. Optional — turn off anytime.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.disabled]}
            onPress={handlePrimary}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={palette.accentContrast} />
            ) : (
              <Text style={styles.primaryText}>
                {settings.enabled
                  ? 'AGREE & ENABLE FOR ALL 4 APPS'
                  : alreadyConsented
                  ? 'OPEN ACCESSIBILITY SETTINGS →'
                  : 'AGREE & OPEN SETTINGS →'}
              </Text>
            )}
          </TouchableOpacity>

          {settings.consented && (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleTurnOff} disabled={busy} activeOpacity={0.8}>
              <Text style={styles.dangerText}>TURN OFF SCROLL DETECTION</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.laterBtn} onPress={controller.closeGuide} disabled={busy} activeOpacity={0.8}>
            <Text style={styles.laterText}>NOT NOW</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  pill: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: c.accentDim,
  },
  pillText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.lg },

  rulesCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  ruleGood: { color: c.accent, fontSize: 16, fontWeight: '900', width: 20, textAlign: 'center', marginTop: 1 },
  ruleQuiet: { color: c.textTertiary, fontSize: 14, fontWeight: '900', width: 20, textAlign: 'center', marginTop: 2 },
  ruleText: { flex: 1, color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  ruleBold: { color: c.textPrimary, fontWeight: '800' },
  ruleDivider: { height: 1, backgroundColor: c.borderSubtle, marginVertical: spacing.md },

  section: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.sm },
  guideCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepSpaced: { marginTop: spacing.md },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: { color: c.accent, fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '700', lineHeight: 18 },

  lookForBox: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
  },
  lookForLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: spacing.sm },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.accentDim,
  },
  mockIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockIconText: { color: c.accentContrast, fontSize: 11, fontWeight: '900' },
  mockBody: { flex: 1 },
  mockName: { color: c.textPrimary, fontSize: 12, fontWeight: '900' },
  mockSub: { color: c.accent, fontSize: 10, fontWeight: '700', marginTop: 2 },
  mockSwitch: {
    width: 38,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.accent,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 3,
  },
  mockKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.accentContrast },

  privacyBox: {
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  privacyTitle: { color: c.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  privacyText: { color: c.textTertiary, fontSize: 11, lineHeight: 16 },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
    backgroundColor: c.bg,
  },
  primaryBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  dangerText: { color: c.danger, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  laterBtn: { alignItems: 'center', paddingVertical: 10 },
  laterText: { color: c.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
});
