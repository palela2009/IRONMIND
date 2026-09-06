import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';
import { usePro } from '../context/ProContext';
import { WELCOME_PLANS, PRO_FEATURES, ProPlanId } from '../constants/pro';

export const WelcomeOfferScreen: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { welcomeOffer, activate, closeWelcomeOffer } = usePro();
  const [busy, setBusy] = useState<ProPlanId | null>(null);

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
          <View style={styles.tag}>
            <Text style={styles.tagText}>ONE-TIME WELCOME OFFER</Text>
          </View>

          <Text style={styles.title}>START AT{'\n'}A LOWER PRICE</Text>
          <Text style={styles.sub}>
            Because it is your first day, IronMind Pro is discounted on every plan. This price is
            only shown once.
          </Text>

          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <Text style={styles.featureText}>{f.title}</Text>
              </View>
            ))}
          </View>

          {WELCOME_PLANS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.planCard, p.id === 'annual' && styles.planCardFeatured]}
              onPress={() => handleSelect(p.id)}
              activeOpacity={0.85}
              disabled={busy !== null}
            >
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
                  <Text style={styles.planPrice}>{p.price}</Text>
                )}
                {p.note && <Text style={styles.planNote}>{p.note}</Text>}
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.declineBtn} onPress={decline} activeOpacity={0.8}>
            <Text style={styles.declineText}>NO THANKS, CONTINUE FREE</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            Subscriptions renew automatically at the standard price after the first term unless
            cancelled. Manage or cancel any time in Google Play. Lifetime is a single payment.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: 64, paddingBottom: 48 },

  tag: {
    alignSelf: 'flex-start',
    backgroundColor: c.accentMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.lg,
  },
  tagText: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },

  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 19, marginTop: spacing.md, marginBottom: spacing.xxl },

  features: { gap: spacing.md, marginBottom: spacing.xxl },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: { color: c.accent, fontSize: 14, width: 20, textAlign: 'center' },
  featureText: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    ...cardShadow,
  },
  planCardFeatured: { borderColor: c.accent, borderWidth: 1.5 },
  planLeft: { flex: 1 },
  planTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  planCadence: { color: c.textTertiary, fontSize: 11, marginTop: 3 },
  planRight: { alignItems: 'flex-end' },
  planPrice: { color: c.accent, fontSize: 22, fontWeight: '900' },
  planNote: {
    color: c.textFaint,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 3,
    textDecorationLine: 'line-through',
  },

  declineBtn: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.sm },
  declineText: { color: c.textTertiary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  legal: { color: c.textFaint, fontSize: 10, lineHeight: 15, marginTop: spacing.sm },
});
