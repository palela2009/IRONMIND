import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Animated, Easing, Share } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing, glowFor } from '../theme';
import { usePro } from '../context/ProContext';
import { purchasesAvailable } from '../config/purchases';
import { PRO_WEEK_PRICE } from '../constants/cosmetics';
import { fetchInviteCode, inviteMessage } from '../hooks/useInvites';

const PERKS = [
  { icon: '❄', title: '20 streak freezes a month', body: 'One slip never wipes out your run.' },
  { icon: '✦', title: '7 elite badges', body: 'Shown next to your name on the leaderboard.' },
  { icon: '◑', title: 'Exclusive themes', body: 'Cyberpunk, Blood, Matrix and more.' },
  { icon: '◈', title: 'Advanced analytics', body: 'Trends, history and reaction-time charts.' },
  { icon: '◉', title: 'Double coins', body: 'Every win pays twice as much.' },
];

export const ProIntroScreen: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const { welcomeOffer, isPro, coins, closeWelcomeOffer } = usePro();
  const visible = welcomeOffer && !isPro && !purchasesAvailable();

  const pulse = useRef(new Animated.Value(1)).current;
  const items = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!visible) return;
    items.forEach((v) => v.setValue(0));
    Animated.stagger(
      140,
      items.map((v) => Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }))
    ).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible]);

  const enter = (i: number) => ({
    opacity: items[i],
    transform: [{ translateY: items[i].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  });

  const shareCode = async () => {
    const code = await fetchInviteCode();
    if (!code) return;
    try {
      await Share.share({ message: inviteMessage(code) });
    } catch {}
  };

  const coinProgress = Math.min(coins / PRO_WEEK_PRICE, 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeWelcomeOffer}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.header, enter(0)]}>
            <Animated.View style={[styles.badge, { transform: [{ scale: pulse }] }]}>
              <Text style={styles.badgeText}>PRO</Text>
            </Animated.View>
            <Text style={styles.title}>Unlock IronMind Pro</Text>
            <Text style={styles.sub}>No payment. You earn it, by playing and by bringing friends.</Text>
          </Animated.View>

          <Animated.View style={[styles.perks, enter(1)]}>
            {PERKS.map((p) => (
              <View key={p.title} style={styles.perkRow}>
                <Text style={styles.perkIcon}>{p.icon}</Text>
                <View style={styles.perkBody}>
                  <Text style={styles.perkTitle}>{p.title}</Text>
                  <Text style={styles.perkText}>{p.body}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          <Animated.View style={enter(2)}>
            <Text style={styles.section}>TWO WAYS TO GET IT</Text>

            <View style={[styles.way, styles.wayFeatured]}>
              <View style={styles.wayHead}>
                <Text style={styles.wayTitle}>INVITE 3 FRIENDS</Text>
                <Text style={styles.wayReward}>7 DAYS PRO</Text>
              </View>
              <Text style={styles.wayText}>
                Share your code. Every friend who joins with it counts straight away. 10 friends unlock a month,
                25 unlock three.
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: '0%' }]} />
              </View>
              <Text style={styles.barLabel}>0 / 3 friends</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={shareCode} activeOpacity={0.88}>
                <Text style={styles.primaryText}>SHARE MY CODE →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.way}>
              <View style={styles.wayHead}>
                <Text style={styles.wayTitle}>EARN {PRO_WEEK_PRICE.toLocaleString()} COINS</Text>
                <Text style={styles.wayReward}>7 DAYS PRO</Text>
              </View>
              <Text style={styles.wayText}>
                +10 for every challenge you win, +50 for a perfect day. Spend them in the Shop on Home, once a month.
              </Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${coinProgress * 100}%` }]} />
              </View>
              <Text style={styles.barLabel}>◉ {coins} / {PRO_WEEK_PRICE.toLocaleString()}</Text>
            </View>
          </Animated.View>

          <Animated.View style={enter(3)}>
            <TouchableOpacity style={styles.goBtn} onPress={closeWelcomeOffer} activeOpacity={0.85}>
              <Text style={styles.goText}>LET'S GO</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: 64, paddingBottom: 48 },

  header: { alignItems: 'center', marginBottom: spacing.xl },
  badge: {
    backgroundColor: c.accent,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    ...glowFor(c),
  },
  badgeText: { color: c.accentContrast, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  title: { color: c.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  sub: { color: c.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: spacing.sm },

  perks: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  perkIcon: { color: c.accent, fontSize: 18, width: 24, textAlign: 'center' },
  perkBody: { flex: 1 },
  perkTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '800' },
  perkText: { color: c.textTertiary, fontSize: 11, marginTop: 2 },

  section: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md },
  way: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  wayFeatured: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  wayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  wayTitle: { color: c.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
  wayReward: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  wayText: { color: c.textSecondary, fontSize: 12, lineHeight: 17, marginBottom: spacing.md },
  barBg: { height: 8, borderRadius: 4, backgroundColor: c.surfaceRaised, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: c.accent },
  barLabel: { color: c.textTertiary, fontSize: 11, fontWeight: '800', marginTop: 6 },
  primaryBtn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing.md },
  primaryText: { color: c.accentContrast, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },

  goBtn: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md, borderWidth: 1, borderColor: c.border },
  goText: { color: c.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
