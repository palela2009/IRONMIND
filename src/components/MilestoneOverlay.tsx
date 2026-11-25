import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { ChallengeItem, UserStats } from '../types/training';
import { rankForLevel } from '../constants/ranks';
import { challengeDay } from '../utils/challengeTime';

interface Props {
  uid?: string;
  stats: UserStats;
  history: ChallengeItem[];
  dailyLimit: number;
  timeZone: string;
  suppressed?: boolean;
}

interface Celebration {
  glyph: string;
  kicker: string;
  headline: string;
  sub: string;
  accentColor?: string;
}

interface StoredMilestones {
  rank: string;
  bestRxn: number;
  perfectDay: string;
}

const HOLD_MS = 4500;

export const MilestoneOverlay: React.FC<Props> = ({ uid, stats, history, dailyLimit, timeZone, suppressed }) => {
  const styles = useThemedStyles(makeStyles);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const initializedFor = useRef<string | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.65)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!uid || suppressed) return;
    const key = `@ironmind_milestones_v1:${uid}`;
    const today = challengeDay(Date.now(), timeZone);
    const todayItems = history.filter((h) => h.counted !== false && challengeDay(h.timestamp, timeZone) === today);
    const isPerfectToday = dailyLimit > 0 && todayItems.length >= dailyLimit && todayItems.every((h) => h.wasSuccessful);
    const currentRank = rankForLevel(stats.level);

    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (cancelled) return;
        if (!raw) {
          const baseline: StoredMilestones = {
            rank: currentRank.name,
            bestRxn: stats.bestReactionTime,
            perfectDay: isPerfectToday ? today : '',
          };
          await AsyncStorage.setItem(key, JSON.stringify(baseline));
          initializedFor.current = uid;
          return;
        }
        const prev: StoredMilestones = JSON.parse(raw);
        const next: StoredMilestones = { ...prev };
        let event: Celebration | null = null;

        if (currentRank.name !== prev.rank && stats.level > 1) {
          next.rank = currentRank.name;
          event = {
            glyph: '▲',
            kicker: 'RANK PROMOTION',
            headline: currentRank.name,
            sub: `Level ${stats.level} reached. Your discipline badge just upgraded on the leaderboard.`,
            accentColor: currentRank.color,
          };
        } else if (isPerfectToday && prev.perfectDay !== today) {
          next.perfectDay = today;
          event = {
            glyph: '★',
            kicker: 'PERFECT DAY',
            headline: `${dailyLimit} / ${dailyLimit}`,
            sub: 'Flawless run today. +50 bonus coins secured.',
          };
        } else if (
          stats.totalChallenges >= 2 &&
          stats.bestReactionTime > 0 &&
          (prev.bestRxn <= 0 || stats.bestReactionTime < prev.bestRxn - 0.05)
        ) {
          next.bestRxn = stats.bestReactionTime;
          event = {
            glyph: '⚡',
            kicker: 'NEW PERSONAL BEST',
            headline: `${stats.bestReactionTime.toFixed(2)}s`,
            sub: stats.bestReactionTime < 1.5
              ? 'Godlike reflex. The feed never stood a chance.'
              : 'Faster exit than ever before. Keep sharpening that reflex.',
          };
        } else {
          if (prev.bestRxn === 0 && stats.bestReactionTime > 0) next.bestRxn = stats.bestReactionTime;
        }

        if (next.rank !== prev.rank || next.bestRxn !== prev.bestRxn || next.perfectDay !== prev.perfectDay) {
          await AsyncStorage.setItem(key, JSON.stringify(next));
        }
        if (event && !cancelled) setCelebration(event);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [uid, stats.level, stats.bestReactionTime, stats.totalChallenges, history.length, dailyLimit, timeZone, suppressed]);

  useEffect(() => {
    if (!celebration) return;
    fade.setValue(0);
    pop.setValue(0.65);
    ring.setValue(0);

    const enter = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 95, useNativeDriver: true }),
      Animated.timing(ring, { toValue: 1, duration: 680, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    const exit = Animated.timing(fade, { toValue: 0, duration: 240, useNativeDriver: true });
    enter.start();
    const timer = setTimeout(() => exit.start(({ finished }) => finished && setCelebration(null)), HOLD_MS);
    return () => {
      clearTimeout(timer);
      enter.stop();
      exit.stop();
    };
  }, [celebration]);

  if (!celebration) return null;

  const badgeStyle = celebration.accentColor ? { borderColor: celebration.accentColor } : null;
  const textAccent = celebration.accentColor ? { color: celebration.accentColor } : null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => setCelebration(null)}>
      <Pressable style={styles.fill} onPress={() => setCelebration(null)}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <View style={styles.center}>
            <View style={styles.badgeWrap}>
              <Animated.View
                style={[
                  styles.ring,
                  badgeStyle,
                  {
                    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.9] }) }],
                  },
                ]}
              />
              <Animated.View style={[styles.badge, badgeStyle, { transform: [{ scale: pop }] }]}>
                <Text style={[styles.glyph, textAccent]}>{celebration.glyph}</Text>
              </Animated.View>
            </View>
            <Text style={[styles.kicker, textAccent]}>{celebration.kicker}</Text>
            <Text style={styles.headline}>{celebration.headline}</Text>
            <Text style={styles.sub}>{celebration.sub}</Text>
            <Text style={styles.skip}>TAP TO CONTINUE</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  center: { alignItems: 'center' },
  badgeWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  ring: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: c.accent,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.accentMuted,
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { color: c.accent, fontSize: 36, fontWeight: '900' },
  kicker: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  headline: {
    color: c.textPrimary,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sub: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  skip: {
    color: c.textFaint,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
