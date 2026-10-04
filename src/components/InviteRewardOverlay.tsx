import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedStyles } from '../context/ThemeContext';
import { usePro } from '../context/ProContext';
import { useAuth } from '../context/AuthContext';
import { Palette, radius, spacing, glowFor } from '../theme';
import { PRO_FEATURES } from '../constants/pro';
import { daysLabel } from '../hooks/useInvites';

const MILESTONE_DAYS: Record<number, number> = { 3: 7, 10: 30, 25: 90 };

export const InviteRewardOverlay: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const { referralRewards, loading } = usePro();
  const { fbUser } = useAuth();
  const [milestone, setMilestone] = useState<number | null>(null);

  const pop = useRef(new Animated.Value(0.5)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const storageKey = fbUser?.uid ? `@ironmind_seen_invite_rewards_${fbUser.uid}` : null;

  useEffect(() => {
    if (loading || !storageKey) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw === null) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(referralRewards));
          return;
        }
        const seen: number[] = JSON.parse(raw);
        const fresh = referralRewards.filter((m) => !seen.includes(m));
        if (fresh.length) setMilestone(Math.max(...fresh));
      } catch {}
    })();
  }, [loading, storageKey, referralRewards.join(',')]);

  useEffect(() => {
    if (milestone === null) return;
    pop.setValue(0.5);
    fade.setValue(0);
    spin.setValue(0);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [milestone]);

  const close = async () => {
    setMilestone(null);
    if (storageKey) await AsyncStorage.setItem(storageKey, JSON.stringify(referralRewards)).catch(() => {});
  };

  if (milestone === null) return null;
  const days = MILESTONE_DAYS[milestone] ?? 7;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <View style={styles.card}>
          <Animated.View
            style={[
              styles.badge,
              {
                transform: [
                  { scale: pop },
                  { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) },
                ],
              },
            ]}
          >
            <Text style={styles.badgeText}>PRO</Text>
          </Animated.View>

          <Text style={styles.kicker}>{milestone} FRIENDS JOINED WITH YOUR CODE</Text>
          <Text style={styles.title}>You unlocked</Text>
          <Text style={styles.days}>{daysLabel(days)}</Text>
          <Text style={styles.subtitle}>of IronMind Pro</Text>

          <View style={styles.perks}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.perkRow}>
                <Text style={styles.perkIcon}>{f.icon}</Text>
                <Text style={styles.perkText}>{f.title}</Text>
              </View>
            ))}
            <View style={styles.perkRow}>
              <Text style={styles.perkIcon}>◉</Text>
              <Text style={styles.perkText}>Double coins on every win</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.btn} onPress={close} activeOpacity={0.88}>
            <Text style={styles.btnText}>LET'S GO</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', paddingHorizontal: spacing.xl },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.accentDim,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: c.accent,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginBottom: spacing.lg,
    ...glowFor(c),
  },
  badgeText: { color: c.accentContrast, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  kicker: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  title: { color: c.textSecondary, fontSize: 15, fontWeight: '700', marginTop: spacing.md },
  days: { color: c.textPrimary, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  subtitle: { color: c.textSecondary, fontSize: 15, fontWeight: '700', marginBottom: spacing.lg },
  perks: { alignSelf: 'stretch', gap: 8, marginBottom: spacing.xl },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  perkIcon: { color: c.accent, fontSize: 15, width: 20, textAlign: 'center' },
  perkText: { color: c.textPrimary, fontSize: 13, fontWeight: '700' },
  btn: { alignSelf: 'stretch', backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center' },
  btnText: { color: c.accentContrast, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
