import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Animated, Easing, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';
import { usePro } from '../context/ProContext';
import { PRO_FEATURES, PRO_COMPARISON } from '../constants/pro';
import { purchasesAvailable } from '../config/purchases';
import { PRO_WEEK_PRICE } from '../constants/cosmetics';
import { fetchInviteCode, inviteMessage, useInvites } from '../hooks/useInvites';

const STREAK_TRIAL_TARGET = 7;

export const ProIntroScreen: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const { welcomeOffer, welcomeGiftAvailable, isPro, coins, closeWelcomeOffer } = usePro();
  const { progress: invites } = useInvites();
  const visible = welcomeOffer && !welcomeGiftAvailable && !isPro && !purchasesAvailable();

  const items = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    items.forEach((v) => v.setValue(0));
    Animated.stagger(
      110,
      items.map((v) => Animated.timing(v, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }))
    ).start();
  }, [visible]);

  const enter = (i: number) => ({
    opacity: items[i],
    transform: [{ translateY: items[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  const shareCode = async () => {
    const code = await fetchInviteCode();
    if (!code) return;
    try {
      await Share.share({ message: inviteMessage(code) });
    } catch {}
  };

  const inviteTarget = invites?.next?.at ?? 3;
  const inviteActive = Math.min(invites?.active ?? 0, inviteTarget);
  const invitePct = Math.min((inviteActive / inviteTarget) * 100, 100);
  const coinPct = Math.min((coins / PRO_WEEK_PRICE) * 100, 100);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeWelcomeOffer}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.brandInline}>IRONMIND <Text style={styles.brandInlinePro}>PRO</Text></Text>
          <TouchableOpacity style={styles.close} onPress={closeWelcomeOffer} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.heroCard, enter(0)]}>
            <View style={styles.heroAccentBar} />
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>★ EARN PRO FREE</Text>
            </View>
            <Text style={styles.heroTitle}>Lock in every streak. Raise the stakes.</Text>
            <Text style={styles.heroSub}>
              No payment required — unlock IronMind Pro free through a 7-win streak, inviting friends, or spending coins you earn.
            </Text>
          </Animated.View>

          <Animated.View style={enter(1)}>
            <Text style={styles.section}>3 WAYS TO UNLOCK PRO FREE</Text>

            <View style={[styles.way, styles.wayFeatured]}>
              <View style={styles.wayHead}>
                <Text style={styles.wayTitle}>🔥 7-WIN STREAK TRIAL</Text>
                <Text style={styles.wayReward}>3 DAYS FREE</Text>
              </View>
              <Text style={styles.wayText}>
                Win {STREAK_TRIAL_TARGET} scroll challenges in a row and 3 days of IronMind Pro unlock automatically.
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: '0%' }]} />
              </View>
              <Text style={styles.barLabel}>0 / {STREAK_TRIAL_TARGET} wins in a row</Text>
            </View>

            <View style={styles.way}>
              <View style={styles.wayHead}>
                <Text style={styles.wayTitle}>🤝 INVITE {inviteTarget} FRIENDS</Text>
                <Text style={styles.wayReward}>UP TO 3 MONTHS</Text>
              </View>
              <Text style={styles.wayText}>
                3 friends → 7 days · 10 friends → 1 month · 25 friends → 3 months of Pro.
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${invitePct}%` }]} />
              </View>
              <Text style={styles.barLabel}>{inviteActive} / {inviteTarget} friends joined</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={shareCode} activeOpacity={0.88}>
                <Text style={styles.primaryText}>SHARE MY INVITE CODE →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.way}>
              <View style={styles.wayHead}>
                <Text style={styles.wayTitle}>◉ SPEND {PRO_WEEK_PRICE.toLocaleString()} COINS</Text>
                <Text style={styles.wayReward}>7 DAYS PRO</Text>
              </View>
              <Text style={styles.wayText}>
                Win scroll challenges (+10), perfect days (+50), and duels. Redeem in the Shop once a month.
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${coinPct}%` }]} />
              </View>
              <Text style={styles.barLabel}>◉ {coins.toLocaleString()} / {PRO_WEEK_PRICE.toLocaleString()}</Text>
            </View>
          </Animated.View>

          <Animated.View style={enter(2)}>
            <Text style={styles.section}>FREE VS PRO</Text>
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

            <Text style={styles.section}>WHAT YOU UNLOCK</Text>
            <View style={styles.perks}>
              {PRO_FEATURES.map((p) => (
                <View key={p.title} style={styles.perkRow}>
                  <View style={styles.perkIconBox}>
                    <Text style={styles.perkIcon}>{p.icon}</Text>
                  </View>
                  <View style={styles.perkBody}>
                    <Text style={styles.perkTitle}>{p.title}</Text>
                    <Text style={styles.perkText}>{p.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View style={enter(3)}>
            <TouchableOpacity style={styles.goBtn} onPress={closeWelcomeOffer} activeOpacity={0.85}>
              <Text style={styles.goText}>START TRAINING →</Text>
            </TouchableOpacity>
          </Animated.View>
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

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 48 },

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

  section: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },

  way: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  wayFeatured: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  wayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
  wayTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  wayReward: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  wayText: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  barBg: { height: 7, borderRadius: 4, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4, backgroundColor: c.accent },
  barLabel: { color: c.textTertiary, fontSize: 11, fontWeight: '800', marginTop: 6 },
  primaryBtn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md },
  primaryText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },

  compareCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: 2,
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

  perks: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  perkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  perkIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  perkIcon: { color: c.accent, fontSize: 16 },
  perkBody: { flex: 1 },
  perkTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '900' },
  perkText: { color: c.textTertiary, fontSize: 12, lineHeight: 17, marginTop: 2 },

  goBtn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  goText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
});
