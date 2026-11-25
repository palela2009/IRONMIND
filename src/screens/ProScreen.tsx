import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, PALETTES, radius, spacing, cardShadow } from '../theme';
import { usePro } from '../context/ProContext';
import { PRO_PLANS, PRO_FEATURES, PRO_COMPARISON, ProPlan, ProPlanId } from '../constants/pro';
import { useStoreProducts } from '../hooks/useStoreProducts';
import { MANAGE_SUBSCRIPTIONS_URL, purchasesAvailable } from '../config/purchases';
import { PRO_WEEK_PRICE } from '../constants/cosmetics';
import { INVITE_RULES, useInvites } from '../hooks/useInvites';

const REFERRAL_STEPS = '3 friends → 7 days · 10 → 1 month · 25 → 3 months';
const STREAK_TRIAL_TARGET = 7;

interface ProScreenProps {
  visible: boolean;
  onClose: () => void;
  onOpenFriends?: () => void;
  onOpenHome?: () => void;
  currentStreak?: number;
}

export const ProScreen: React.FC<ProScreenProps> = ({
  visible,
  onClose,
  onOpenFriends,
  onOpenHome,
  currentStreak = 0,
}) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const {
    isPro, onTrial, trialEndsAt, streakTrialClaimed, coins, plan, source, expiresAt,
    streakFreezes, themeId, unlockedThemes, setTheme, purchase, restore,
  } = usePro();
  const { progress: invites } = useInvites();
  const [busy, setBusy] = useState<ProPlanId | 'restore' | null>(null);
  const { priceFor, productFor } = useStoreProducts(PRO_PLANS, visible && !isPro);

  const chooseTheme = (id: string, requiresPro: boolean) => {
    const owned = !requiresPro || isPro || unlockedThemes.includes(id);
    if (!owned) {
      appAlert('Locked theme', 'Unlock this theme with IronMind Pro or buy it with coins in the Shop.');
      return;
    }
    void setTheme(id);
  };

  const handleSelect = async (p: ProPlan) => {
    const product = productFor(p);
    if (!product) {
      appAlert('Not available yet', 'Purchases are not available right now. Try again later.');
      return;
    }
    setBusy(p.id);
    const outcome = await purchase(product);
    setBusy(null);
    if (outcome === 'purchased') {
      appAlert('Welcome to Pro', 'Every Pro feature is now unlocked.');
    } else if (outcome === 'pending') {
      appAlert('Confirming your purchase', 'Your purchase is awaiting confirmation. We will retry automatically. Please do not buy again.');
    } else if (outcome === 'failed') {
      appAlert('Purchase did not go through', 'Check your Google Play purchase history or use Restore purchases before trying again.');
    }
  };

  const handleRestore = async () => {
    setBusy('restore');
    const outcome = await restore();
    setBusy(null);
    appAlert(
      outcome === 'restored' ? 'Purchases restored' : outcome === 'pending' ? 'Checking your purchases' : outcome === 'none' ? 'Nothing to restore' : 'Could not restore purchases',
      outcome === 'restored' ? 'Your Pro purchase has been confirmed.' : outcome === 'pending' ? 'Verification is pending. We will retry automatically.' : outcome === 'none' ? 'No active Pro purchase was found for this Google account.' : 'Check your connection and try Restore purchases again.'
    );
  };

  const streakProgress = Math.min(currentStreak, STREAK_TRIAL_TARGET);
  const streakPct = Math.min((streakProgress / STREAK_TRIAL_TARGET) * 100, 100);
  const inviteTarget = invites?.next?.at ?? 3;
  const inviteActive = Math.min(invites?.active ?? 0, inviteTarget);
  const invitePct = Math.min((inviteActive / inviteTarget) * 100, 100);
  const coinPct = Math.min((coins / PRO_WEEK_PRICE) * 100, 100);

  const activeExpiry = onTrial && trialEndsAt
    ? `3-day streak trial · ends ${new Date(trialEndsAt).toLocaleDateString()}`
    : plan === 'lifetime'
    ? 'Lifetime access — never expires.'
    : expiresAt
    ? source === 'store'
      ? `${plan?.toUpperCase()} · renews ${new Date(expiresAt).toLocaleDateString()}`
      : `Pro until ${new Date(expiresAt).toLocaleDateString()}`
    : plan?.toUpperCase() ?? 'All Pro perks unlocked';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.brandInline}>IRONMIND <Text style={styles.brandInlinePro}>PRO</Text></Text>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isPro ? (
            <View style={styles.activeCard}>
              <View style={styles.activeTopRow}>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>{onTrial ? '★ FREE TRIAL' : '★ PRO ACTIVE'}</Text>
                </View>
                <Text style={styles.activeSubInline}>{activeExpiry}</Text>
              </View>
              <View style={styles.activePillRow}>
                <View style={styles.activeStatPill}>
                  <Text style={styles.activeFreezeVal}>❄ {streakFreezes}</Text>
                  <Text style={styles.activeStatLabel}>FREEZES LEFT</Text>
                </View>
                <View style={styles.activeStatPill}>
                  <Text style={styles.activeAccentVal}>2× COINS</Text>
                  <Text style={styles.activeStatLabel}>DOUBLE REWARDS</Text>
                </View>
                <View style={styles.activeStatPill}>
                  <Text style={styles.activeAccentVal}>◉ 250</Text>
                  <Text style={styles.activeStatLabel}>HIGH STAKES</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.heroCard}>
              <View style={styles.heroAccentBar} />
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>★ IRONMIND PRO</Text>
              </View>
              <Text style={styles.heroTitle}>Lock in every streak. Raise the stakes.</Text>
              <Text style={styles.heroSub}>
                20 monthly Streak Freezes, 2× coins, High-Stakes Duels, all 9 themes + Aurora frame, and pinnable leaderboard badges.
              </Text>
            </View>
          )}

          {!isPro && (
            <>
              <Text style={styles.sectionLabel}>3 WAYS TO UNLOCK PRO FREE</Text>

              <View style={[styles.earnCard, !streakTrialClaimed && styles.earnCardHighlight]}>
                <View style={styles.earnHead}>
                  <Text style={styles.earnTitle}>🔥 7-WIN STREAK TRIAL</Text>
                  <Text style={styles.earnReward}>{streakTrialClaimed ? 'CLAIMED ✓' : '3 DAYS FREE'}</Text>
                </View>
                <Text style={styles.earnDesc}>
                  {streakTrialClaimed
                    ? 'You already unlocked your free 3-day streak trial.'
                    : 'Hit a 7-challenge win streak and 3 days of Pro unlock automatically — no card needed.'}
                </Text>
                {!streakTrialClaimed && (
                  <>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, { width: `${streakPct}%` }]} />
                    </View>
                    <Text style={styles.barCaption}>{streakProgress} / {STREAK_TRIAL_TARGET} wins in a row</Text>
                  </>
                )}
              </View>

              <TouchableOpacity style={styles.earnCard} onPress={onOpenFriends ?? onClose} activeOpacity={0.85}>
                <View style={styles.earnHead}>
                  <Text style={styles.earnTitle}>🤝 INVITE FRIENDS</Text>
                  <Text style={styles.earnReward}>UP TO 3 MONTHS</Text>
                </View>
                <Text style={styles.earnDesc}>{REFERRAL_STEPS}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${invitePct}%` }]} />
                </View>
                <View style={styles.earnFooter}>
                  <Text style={styles.barCaption}>{inviteActive} / {inviteTarget} friends joined</Text>
                  <Text style={styles.earnGo}>OPEN INVITES →</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.earnCard} onPress={onOpenHome ?? onClose} activeOpacity={0.85}>
                <View style={styles.earnHead}>
                  <Text style={styles.earnTitle}>◉ SPEND COINS IN SHOP</Text>
                  <Text style={styles.earnReward}>7 DAYS PRO</Text>
                </View>
                <Text style={styles.earnDesc}>
                  Redeem ◉ {PRO_WEEK_PRICE.toLocaleString()} coins once a month. Earn coins from scroll wins and duels.
                </Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${coinPct}%` }]} />
                </View>
                <View style={styles.earnFooter}>
                  <Text style={styles.barCaption}>◉ {coins.toLocaleString()} / {PRO_WEEK_PRICE.toLocaleString()}</Text>
                  <Text style={styles.earnGo}>OPEN SHOP →</Text>
                </View>
              </TouchableOpacity>

              {!purchasesAvailable() && (
                <Text style={styles.legalInline}>{INVITE_RULES} Coins come from winning challenges and duels.</Text>
              )}
            </>
          )}

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
          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <View style={styles.featureIconBox}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {!isPro && purchasesAvailable() && (
            <>
              <Text style={styles.sectionLabel}>OR UPGRADE INSTANTLY</Text>
              {PRO_PLANS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.planCard, p.id === 'annual' && styles.planCardFeatured]}
                  onPress={() => handleSelect(p)}
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
                      <Text style={styles.planPrice}>{priceFor(p)}</Text>
                    )}
                    {p.note && <Text style={styles.planNote}>{p.note}</Text>}
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={styles.legal}>
                Subscriptions renew automatically until cancelled. Manage or cancel any time in Google Play. Lifetime is a single payment with no renewal.
              </Text>

              <TouchableOpacity style={styles.cancelBtn} onPress={handleRestore} activeOpacity={0.8} disabled={busy !== null}>
                {busy === 'restore' ? (
                  <ActivityIndicator color={palette.textTertiary} size="small" />
                ) : (
                  <Text style={styles.cancelText}>RESTORE PURCHASES</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.sectionLabel}>ALL {PALETTES.length} THEMES</Text>
          <View style={styles.themeGrid}>
            {PALETTES.map((p) => {
              const owned = !p.pro || isPro || unlockedThemes.includes(p.id);
              const locked = !owned;
              const active = themeId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.themeCard,
                    { backgroundColor: p.surface, borderColor: active ? p.accent : p.border },
                    locked && styles.themeCardLocked,
                  ]}
                  onPress={() => chooseTheme(p.id, p.pro)}
                  activeOpacity={0.85}
                >
                  <View style={styles.swatchRow}>
                    <View style={[styles.swatch, { backgroundColor: p.bg }]} />
                    <View style={[styles.swatch, { backgroundColor: p.surfaceRaised }]} />
                    <View style={[styles.swatchAccent, { backgroundColor: p.accent }]} />
                  </View>
                  <Text style={[styles.themeName, { color: p.textPrimary }]}>{p.name}</Text>
                  <Text style={[styles.themeTagline, { color: p.textTertiary }]} numberOfLines={2}>
                    {p.tagline}
                  </Text>
                  {locked ? (
                    <Text style={[styles.themeBadge, { color: p.textTertiary }]}>PRO / SHOP</Text>
                  ) : active ? (
                    <Text style={[styles.themeBadge, { color: p.accent }]}>ACTIVE ✓</Text>
                  ) : (
                    <Text style={[styles.themeBadge, { color: p.textSecondary }]}>OWNED</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {isPro && source === 'store' && plan !== 'lifetime' && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)} activeOpacity={0.8}>
              <Text style={styles.cancelText}>MANAGE SUBSCRIPTION</Text>
            </TouchableOpacity>
          )}
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
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 48 },

  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  heroCard: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: c.accent,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...cardShadow,
  },
  heroAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: c.accent },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  heroBadgeText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 28, marginBottom: spacing.sm },
  heroSub: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },

  activeCard: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: c.accent,
    marginBottom: spacing.xl,
  },
  activeTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: spacing.md, flexWrap: 'wrap' },
  activeBadge: { backgroundColor: c.accent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  activeBadgeText: { color: c.accentContrast, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  activeSubInline: { color: c.textSecondary, fontSize: 11, fontWeight: '700' },
  activePillRow: { flexDirection: 'row', gap: spacing.sm },
  activeStatPill: { flex: 1, backgroundColor: c.surface, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  activeFreezeVal: { color: '#9FD8FF', fontSize: 14, fontWeight: '900' },
  activeAccentVal: { color: c.accent, fontSize: 13, fontWeight: '900' },
  activeStatLabel: { color: c.textTertiary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },

  sectionLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },

  earnCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  earnCardHighlight: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  earnHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  earnTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  earnReward: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  earnDesc: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  barBg: { height: 7, borderRadius: 4, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: c.accent },
  earnFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  barCaption: { color: c.textTertiary, fontSize: 11, fontWeight: '800', marginTop: 6 },
  earnGo: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginTop: 6 },
  legalInline: { color: c.textTertiary, fontSize: 11, lineHeight: 16, marginBottom: spacing.xl, marginTop: 2 },

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

  features: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  featureRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
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
  featureText: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },

  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.xl },
  themeCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  themeCardLocked: { opacity: 0.6 },
  swatchRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  swatch: { width: 16, height: 16, borderRadius: 5 },
  swatchAccent: { width: 28, height: 16, borderRadius: 5 },
  themeName: { fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  themeTagline: { fontSize: 11, lineHeight: 15, marginTop: 3, minHeight: 30 },
  themeBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginTop: 4 },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  planCardFeatured: { borderColor: c.accent, backgroundColor: c.accentMuted },
  planLeft: { flex: 1, marginRight: 10 },
  planTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  planCadence: { color: c.textTertiary, fontSize: 11, marginTop: 3 },
  planRight: { alignItems: 'flex-end' },
  planPrice: { color: c.accent, fontSize: 20, fontWeight: '900' },
  planNote: { color: c.accentDim, fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },

  legal: { color: c.textTertiary, fontSize: 11, lineHeight: 16, marginTop: 6, marginBottom: spacing.md },

  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginBottom: spacing.md },
  cancelText: { color: c.textTertiary, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
