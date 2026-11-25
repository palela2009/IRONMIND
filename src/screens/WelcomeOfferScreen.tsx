import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow, glowFor } from '../theme';
import { usePro } from '../context/ProContext';
import { WELCOME_PLANS, PRO_PLANS, PRO_FEATURES, PRO_COMPARISON, ProPlan, ProPlanId, discountPercent, MAX_WELCOME_DISCOUNT } from '../constants/pro';
import { PRO_WEEK_PRICE } from '../constants/cosmetics';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { WELCOME_OFFER_TAG, purchasesAvailable } from '../config/purchases';

export const WelcomeOfferScreen: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const { welcomeOffer, welcomeGiftAvailable, purchasePending, purchase, closeWelcomeOffer } = usePro();
  const [busy, setBusy] = useState<ProPlanId | null>(null);

  const visible = welcomeOffer && !welcomeGiftAvailable && !purchasePending && purchasesAvailable();
  const welcome = useStoreProducts(WELCOME_PLANS, visible, WELCOME_OFFER_TAG);
  const standard = useStoreProducts(PRO_PLANS, visible);

  const handleSelect = async (p: ProPlan) => {
    const product = welcome.productFor(p);
    if (!product) {
      appAlert('Not available yet', 'Purchases are not available right now. Try again later.');
      return;
    }
    setBusy(p.id);
    const outcome = await purchase(product, WELCOME_OFFER_TAG);
    setBusy(null);

    if (outcome === 'purchased') {
      await closeWelcomeOffer();
    } else if (outcome === 'pending') {
      appAlert('Confirming your purchase', 'We will retry confirmation automatically. Please do not buy again.');
    } else if (outcome === 'failed') {
      appAlert('Purchase did not go through', 'Check your Google Play purchase history or use Restore purchases before trying again.');
    }
  };

  const decline = () => {
    appAlert(
      'Skip this offer?',
      'This is a one-time welcome price. You can still earn Pro free via a 7-win streak, invites, or 500 coins anytime.',
      [
        { text: 'Keep looking', style: 'cancel' },
        { text: 'Continue free', style: 'destructive', onPress: closeWelcomeOffer },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={decline}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.brandInline}>IRONMIND <Text style={styles.brandInlinePro}>PRO</Text></Text>
          <TouchableOpacity style={styles.close} onPress={decline} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroAccentBar} />
            <View style={styles.tag}>
              <Text style={styles.tagText}>★ ONE-TIME WELCOME OFFER</Text>
            </View>
            <Text style={styles.saveNum}>{`${MAX_WELCOME_DISCOUNT()}% OFF`}</Text>
            <Text style={styles.heroTitle}>Lock in every streak. Raise the stakes.</Text>
            <Text style={styles.sub}>
              The lowest price IronMind Pro will ever be — shown once when you join.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>CHOOSE YOUR WELCOME PLAN</Text>
          {WELCOME_PLANS.map((p) => {
            const full = PRO_PLANS.find((s) => s.id === p.id);
            const featured = p.id === 'annual';
            const off = discountPercent(p.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.planCard, featured && styles.planCardFeatured]}
                onPress={() => handleSelect(p)}
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
                        <Text style={styles.oldPrice}>{full ? standard.priceFor(full) : ''}</Text>
                        <Text style={styles.newPrice}>{welcome.priceFor(p)}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.planFoot}>
                  <View style={styles.offPill}>
                    <Text style={styles.offText}>SAVE {off}%</Text>
                  </View>
                  <Text style={styles.planGo}>UNLOCK PRO →</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.sectionLabel}>FREE VS PRO</Text>
          <View style={styles.compareCard}>
            <View style={styles.compareHeaderRow}>
              <Text style={[styles.compareColLabel, styles.comparePerkCol]}>FEATURE</Text>
              <Text style={[styles.compareColLabel, styles.compareValCol]}>FREE</Text>
              <Text style={[styles.compareColLabel, styles.compareValCol, styles.compareProHead]}>PRO</Text>
            </View>
            {PRO_COMPARISON.map((row, idx) => (
              <View key={row.label} style={[styles.compareRow, idx > 0 && styles.compareRowBorder]}>
                <Text style={[styles.comparePerkText, styles.comparePerkCol]}>{row.label}</Text>
                <Text style={[styles.compareFreeText, styles.compareValCol]}>{row.free}</Text>
                <Text style={[styles.compareProText, styles.compareValCol]}>{row.pro}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>WHAT YOU UNLOCK</Text>
          <View style={styles.featureCard}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.reassureCard}>
            <Text style={styles.reassureTitle}>FREE IS A FULL APP — AND YOU CAN EARN PRO FREE</Text>
            <Text style={styles.reassureBody}>
              Scroll-Only protection across all 5 apps, daily limits, friends, and duels work free. You can also unlock Pro free anytime:
            </Text>
            <View style={styles.freeWays}>
              <Text style={styles.freeWayItem}>🔥 Hit a 7-win streak → 3 days Pro free</Text>
              <Text style={styles.freeWayItem}>🤝 Invite 3 friends → 7 days Pro free (up to 3 months)</Text>
              <Text style={styles.freeWayItem}>◉ Redeem {PRO_WEEK_PRICE} coins in Shop → 7 days Pro free</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.declineBtn} onPress={decline} activeOpacity={0.8}>
            <Text style={styles.declineText}>NO THANKS, CONTINUE FREE</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            Subscriptions renew automatically at the standard price after the first term unless
            cancelled. Manage or cancel any time in Google Play. Lifetime is a single payment with
            no renewal.
          </Text>
        </ScrollView>
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
  brandInline: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  brandInlinePro: { color: c.accent },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 44 },

  heroCard: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: c.accent,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...cardShadow,
  },
  heroAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: c.accent },
  tag: {
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  tagText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  saveNum: {
    color: c.accent,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 50,
    ...glowFor(c),
  },
  heroTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center', marginTop: spacing.sm },
  sub: { color: c.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },

  sectionLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },

  planCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
    ...cardShadow,
  },
  planCardFeatured: { borderColor: c.accent, borderWidth: 1.5, backgroundColor: c.accentMuted },
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
  oldPrice: { color: c.textFaint, fontSize: 13, fontWeight: '700', textDecorationLine: 'line-through', marginBottom: 3 },
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
  offPill: { backgroundColor: c.accentMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  offText: { color: c.accent, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  planGo: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  compareCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  compareHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border },
  compareColLabel: { color: c.textTertiary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  compareProHead: { color: c.accent },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  compareRowBorder: { borderTopWidth: 1, borderColor: c.borderSubtle },
  comparePerkCol: { flex: 1.5, paddingRight: 6 },
  compareValCol: { flex: 0.9, textAlign: 'right' },
  comparePerkText: { color: c.textPrimary, fontSize: 12, fontWeight: '700' },
  compareFreeText: { color: c.textTertiary, fontSize: 11, fontWeight: '700' },
  compareProText: { color: c.accent, fontSize: 11, fontWeight: '900' },

  featureCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureIcon: { color: c.accent, fontSize: 16 },
  featureBody: { flex: 1 },
  featureTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', marginBottom: 2 },
  featureDesc: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },

  reassureCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  reassureTitle: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  reassureBody: { color: c.textSecondary, fontSize: 12, lineHeight: 18 },
  freeWays: { gap: 5, marginTop: 4 },
  freeWayItem: { color: c.textPrimary, fontSize: 12, fontWeight: '700', lineHeight: 18 },

  declineBtn: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.sm },
  declineText: { color: c.textTertiary, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },

  legal: { color: c.textFaint, fontSize: 10, lineHeight: 15 },
});
