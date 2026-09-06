import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { usePro } from '../context/ProContext';
import { useRewardedAd, AD_UNITS, AD_SDK_INSTALLED } from '../hooks/useRewardedAd';
import { radius, spacing, Palette } from '../theme';
import { useThemedStyles, useTheme } from '../context/ThemeContext';

interface Props {
  lostStreak: number;
  onReclaim: () => void;
  onDismiss: () => void;
  onOpenPro: () => void;
}

export const StreakReclaimModal: React.FC<Props> = ({ lostStreak, onReclaim, onDismiss, onOpenPro }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { isPro, streakFreezes } = usePro();
  const { show, showing } = useRewardedAd();
  const [step, setStep] = useState<'offer' | 'ad'>('offer');

  const visible = lostStreak > 0;

  useEffect(() => {
    if (visible) setStep('offer');
  }, [visible]);

  const watchAd = async () => {
    const result = await show(AD_UNITS.streakReclaim);
    if (result === 'rewarded') onReclaim();
    else onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.broken}>✕</Text>
          <Text style={styles.title}>STREAK LOST</Text>
          <Text style={styles.streakValue}>{lostStreak}</Text>
          <Text style={styles.streakLabel}>
            {lostStreak === 1 ? 'CHALLENGE STREAK' : 'CHALLENGE STREAK'} BROKEN
          </Text>

          {step === 'offer' ? (
            <>
              <Text style={styles.body}>
                {isPro && streakFreezes === 0
                  ? 'You are out of streak freezes. Reclaim this streak to keep it alive.'
                  : 'IronMind Pro gives you streak freezes that absorb a failed challenge automatically.'}
              </Text>

              {!isPro && (
                <TouchableOpacity style={styles.primaryBtn} onPress={onOpenPro} activeOpacity={0.85}>
                  <Text style={styles.primaryText}>GET PRO — RECLAIM YOUR STREAK</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('ad')} activeOpacity={0.85}>
                <Text style={styles.secondaryText}>
                  {isPro ? 'WATCH AN AD TO RECLAIM' : 'SKIP'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ghostBtn} onPress={onDismiss} activeOpacity={0.8}>
                <Text style={styles.ghostText}>LET IT GO</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Watch a short video and your {lostStreak}-challenge streak is restored.
              </Text>

              {!AD_SDK_INSTALLED && (
                <Text style={styles.placeholder}>
                  Ads are not wired up yet — this is a placeholder that grants the reward so the
                  flow can be tested.
                </Text>
              )}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={watchAd}
                activeOpacity={0.85}
                disabled={showing}
              >
                {showing ? (
                  <ActivityIndicator color={palette.accentContrast} size="small" />
                ) : (
                  <Text style={styles.primaryText}>WATCH AD — RECLAIM STREAK</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.ghostBtn} onPress={onDismiss} activeOpacity={0.8} disabled={showing}>
                <Text style={styles.ghostText}>LET IT GO</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', paddingHorizontal: spacing.xxl },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  broken: { color: c.danger, fontSize: 26, fontWeight: '900', marginBottom: spacing.sm },
  title: { color: c.danger, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  streakValue: { color: c.textPrimary, fontSize: 56, fontWeight: '900', letterSpacing: -2, marginTop: spacing.sm },
  streakLabel: { color: c.textTertiary, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xl },
  body: { color: c.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: spacing.xl },
  placeholder: {
    color: c.textFaint,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  primaryText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  secondaryBtn: {
    backgroundColor: c.surfaceRaised,
    borderRadius: radius.sm,
    paddingVertical: 15,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: spacing.sm,
  },
  secondaryText: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  ghostBtn: { paddingVertical: spacing.md, alignItems: 'center', alignSelf: 'stretch' },
  ghostText: { color: c.textFaint, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
