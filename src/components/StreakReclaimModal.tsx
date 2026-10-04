import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { usePro } from '../context/ProContext';
import { useRewardedAd, AD_UNITS, ADS_AVAILABLE } from '../hooks/useRewardedAd';
import { PRICES } from '../screens/ShopScreen';
import { radius, spacing, Palette } from '../theme';
import { useThemedStyles, useTheme } from '../context/ThemeContext';

interface Props {
  lostStreak: number;
  onReclaim: (source: 'ad' | 'coins') => void;
  onDismiss: () => void;
  onOpenPro: () => void;
}

export const StreakReclaimModal: React.FC<Props> = ({ lostStreak, onReclaim, onDismiss, onOpenPro }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { isPro, coins, buyItem } = usePro();
  const { show, showing } = useRewardedAd();
  const [step, setStep] = useState<'offer' | 'ad'>('offer');
  const [buying, setBuying] = useState(false);

  const visible = lostStreak > 0;
  const canAfford = coins >= PRICES.reclaim;

  useEffect(() => {
    if (visible) setStep('offer');
  }, [visible]);

  const saveWithCoins = async () => {
    if (!canAfford) {
      Alert.alert('Not enough coins', `Saving this streak costs ◉ ${PRICES.reclaim}. You have ◉ ${coins}. Win challenges to earn more.`);
      return;
    }
    setBuying(true);
    const result = await buyItem('reclaim');
    setBuying(false);
    if (result.ok) {
      onReclaim('coins');
    } else {
      Alert.alert('Could not save your streak', result.message ?? 'Try again.');
    }
  };

  const watchAd = async () => {
    const result = await show(AD_UNITS.streakReclaim);
    if (result === 'rewarded') {
      onReclaim('ad');
      return;
    }
    if (result === 'unavailable') {
      Alert.alert('No ad available', 'We could not load an ad just now, so your streak is safe this time.');
      onReclaim('ad');
      return;
    }
    onDismiss();
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
                You had no streak freeze to absorb that one. Save your run now for double the price of a freeze.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, !canAfford && styles.primaryBtnDim]}
                onPress={saveWithCoins}
                activeOpacity={0.85}
                disabled={buying}
              >
                {buying ? (
                  <ActivityIndicator color={palette.accentContrast} size="small" />
                ) : (
                  <Text style={styles.primaryText}>SAVE MY STREAK · ◉ {PRICES.reclaim}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.balance}>You have ◉ {coins}</Text>

              {!isPro && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={onOpenPro} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>GET PRO · 20 FREEZES A MONTH</Text>
                </TouchableOpacity>
              )}

              {ADS_AVAILABLE && (
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('ad')} activeOpacity={0.85}>
                  <Text style={styles.secondaryText}>
                    {isPro ? 'WATCH AN AD TO RECLAIM' : 'SKIP'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.ghostBtn} onPress={onDismiss} activeOpacity={0.8}>
                <Text style={styles.ghostText}>LET IT GO</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Watch a short video and your {lostStreak}-challenge streak is restored.
              </Text>

              {__DEV__ && (
                <Text style={styles.placeholder}>
                  Test ad — real ads serve once AdMob is connected.
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
  primaryBtnDim: { opacity: 0.55 },
  balance: { color: c.textTertiary, fontSize: 11, fontWeight: '700', marginTop: -2, marginBottom: spacing.md },
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
