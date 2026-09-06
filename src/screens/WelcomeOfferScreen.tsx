import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow, glowFor } from '../theme';
import { usePro } from '../context/ProContext';
import { WELCOME_PLANS, PRO_PLANS, PRO_FEATURES, ProPlanId, discountPercent, MAX_WELCOME_DISCOUNT } from '../constants/pro';

export const WelcomeOfferScreen: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { welcomeOffer, trialAvailable, activate, startTrial, closeWelcomeOffer } = usePro();
  const [busy, setBusy] = useState<ProPlanId | null>(null);
  const [startingTrial, setStartingTrial] = useState(false);

  // Trial first, discount only if they turn it down. Showing both at once makes the reader
  // choose between two good offers instead of accepting one, and the discount lands far
  // harder as a response to "no" than as a competing option.
  const [stage, setStage] = useState<'trial' | 'discount'>(trialAvailable ? 'trial' : 'discount');

  const beginTrial = async () => {
    setStartingTrial(true);
    const ok = await startTrial();
    setStartingTrial(false);
    if (!ok) {
      Alert.alert('Could not start trial', 'Try again in a moment.');
      return;
    }
    await closeWelcomeOffer();
  };

  const handleSelect = async (planId: ProPlanId) => {
    setBusy(planId);
    const ok = await activate(planId);
    setBusy(null);

    if (ok) {
      await closeWelcomeOffer();
      return;
    }

    Alert.alert(
      'Not available yet',
      'In-app purchases are not live yet. They will switch on once IronMind is published to Google Play.'
    );
  };

  const decline = () => {
    Alert.alert(
      'Skip this offer?',
      'This is a one-time welcome price. If you close it now it will not come back.',
      [
        { text: 'Keep looking', style: 'cancel' },
        { text: 'Skip anyway', style: 'destructive', onPress: closeWelcomeOffer },
      ]
    );
  };

  return (
    <Modal visible={welcomeOffer} animationType="slide" onRequestClose={decline}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {stage === 'trial' ? 'FREE FOR YOUR FIRST WEEK' : 'ONE-TIME WELCOME OFFER'}
              </Text>
            </View>

            <Text style={styles.saveNum}>{stage === 'trial' ? '7' : `${MAX_WELCOME_DISCOUNT()}%`}</Text>
            <Text style={styles.saveWord}>
              {stage === 'trial' ? 'DAYS OF PRO, FREE' : 'OFF IRONMIND PRO'}
            </Text>
            <Text style={styles.sub}>
              {stage === 'trial'
                ? 'Everything below, unlocked for seven days. No card, no charge — it simply ends unless you choose to continue.'
                : 'No problem. Here is the lowest price IronMind Pro will ever be, shown once.'}
            </Text>
          </View>

          <View style={styles.featureCard}>
            {PRO_FEATURES.map((f, i) => (
              <View key={f.title} style={[styles.featureRow, i > 0 && styles.featureRowDivided]}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.title}</Text>
                <Text style={styles.featureTick}>✓</Text>
              </View>
            ))}
          </View>

          {stage === 'trial' && (
            <>
              <TouchableOpacity
                style={styles.trialBtn}
                onPress={beginTrial}
                activeOpacity={0.88}
                disabled={startingTrial}
              >
                {startingTrial ? (
                  <ActivityIndicator color={palette.accentContrast} />
                ) : (
                  <Text style={styles.trialBtnText}>START MY 7 FREE DAYS</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.declineBtn}
                onPress={() => setStage('discount')}
                activeOpacity={0.8}
                disabled={startingTrial}
              >
                <Text style={styles.declineText}>NOT NOW</Text>
              </TouchableOpacity>

              <Text style={styles.legal}>
                The trial unlocks every Pro feature for seven days and then simply stops. No
                payment details are taken and nothing renews.
              </Text>
            </>
          )}

          {stage === 'discount' && WELCOME_PLANS.map((p) => {
            const full = PRO_PLANS.find((s) => s.id === p.id);
            const featured = p.id === 'annual';
            const off = discountPercent(p.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.planCard, featured && styles.planCardFeatured]}
                onPress={() => handleSelect(p.id)}
                activeOpacity={0.88}
                disabled={busy !== null}
              >
                {featured && (
                  <View style={styles.ribbon}>
                    <Text style={styles.ribbonText}>BEST VALUE</Text>
                  </View>
                )}

                <View style={styles.planTop}>
                  <View style={styles.planLeft}>
                    <Text style={styles.planTitle}>{p.title}</Text>
                    <Text style={styles.planCadence}>
                      {p.cadence}
                      {p.perMonth ? ` · ${p.perMonth}` : ''}
                    </Text>
                  </View>

                  <View style={styles.planRight}>
                    {busy === p.id ? (
                      <ActivityIndicator color={palette.accent} size="small" />
                    ) : (
                      <View style={styles.priceRow}>
                        <Text style={styles.oldPrice}>{full?.price}</Text>
                        <Text style={styles.newPrice}>{p.price}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.planFoot}>
                  <View style={styles.offPill}>
                    <Text style={styles.offText}>SAVE {off}%</Text>
                  </View>
                  <Text style={styles.planGo}>TAP TO CHOOSE →</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {stage === 'discount' && (
            <TouchableOpacity style={styles.declineBtn} onPress={decline} activeOpacity={0.8}>
              <Text style={styles.declineText}>NO THANKS, CONTINUE FREE</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.legal}>
            {stage === 'trial' ? '' : `Subscriptions renew automatically at the standard price after the first term unless
            cancelled. Manage or cancel any time in Google Play. Lifetime is a single payment with
            no renewal.`}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 44 },

  header: { alignItems: 'center', marginBottom: spacing.xxl },
  tag: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.lg,
  },
  tagText: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },

  saveNum: {
    color: c.accent,
    fontSize: 84,
    fontWeight: '900',
    letterSpacing: -5,
    lineHeight: 86,
    ...glowFor(c),
  },
  saveWord: {
    color: c.textPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: -spacing.xs,
  },
  sub: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  featureCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13 },
  featureRowDivided: { borderTopWidth: 1, borderColor: c.borderSubtle },
  featureIcon: { color: c.accent, fontSize: 15, width: 22, textAlign: 'center' },
  featureText: { flex: 1, color: c.textPrimary, fontSize: 13, fontWeight: '700' },
  featureTick: { color: c.accent, fontSize: 13, fontWeight: '900' },

  planCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    ...cardShadow,
  },
  planCardFeatured: { borderColor: c.accent, borderWidth: 1.5, backgroundColor: c.surfaceRaised },

  ribbon: {
    position: 'absolute',
    top: -1,
    right: spacing.lg,
    backgroundColor: c.accent,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  ribbonText: { color: c.accentContrast, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },

  planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planLeft: { flex: 1 },
  planTitle: { color: c.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  planCadence: { color: c.textTertiary, fontSize: 11, marginTop: 3 },

  planRight: { alignItems: 'flex-end' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  oldPrice: {
    color: c.textFaint,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'line-through',
    marginBottom: 3,
  },
  newPrice: { color: c.accent, fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },

  planFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
  },
  offPill: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  offText: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  planGo: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  trialBtn: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    ...cardShadow,
  },
  trialBtnText: { color: c.accentContrast, fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },

  declineBtn: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.sm },
  declineText: { color: c.textTertiary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  legal: { color: c.textFaint, fontSize: 10, lineHeight: 15 },
});
