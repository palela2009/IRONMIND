import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing } from '../theme';
import { useScreenTime, formatMinutes, trackedTotal, todayKey } from '../hooks/useScreenTime';
import { UserStats } from '../types/training';

interface Props {
  isPro: boolean;
  stats: UserStats;
  onUnlock: () => void;
}

const GENERAL = [
  'Every challenge you win is proof you are in charge, not the feed. Stack the proof.',
  'Boredom is not an emergency. Sit with it for two minutes before you reach for your phone.',
  'Put your phone on the other side of the room for the next hour. Distance beats willpower.',
  'Notifications are other people deciding when you look at your phone. Turn off the ones that do not matter.',
  'Pick one thing you keep postponing and give it the next 20 minutes instead of a scroll.',
  'Your best reaction times come when you decide before you open an app, not after.',
  'Grey out the screen tonight. A colourless feed is a boring feed.',
];

const daySeed = (): number => {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
};

export const CoachCard: React.FC<Props> = ({ isPro, stats, onUnlock }) => {
  const styles = useThemedStyles(makeStyles);
  const { screenTime, tracked, week, trackedToday } = useScreenTime();

  const tip = useMemo(() => {
    const hour = new Date().getHours();
    const past = week.filter((w) => w.date < todayKey()).map((w) => trackedTotal(w.apps, tracked));
    const average = past.length ? past.reduce((a, b) => a + b, 0) / past.length : null;
    const top = tracked
      .map((app) => ({ app, minutes: screenTime.find((s) => s.app === app)?.minutes ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes)[0];

    const personal: string[] = [];
    if (average !== null && trackedToday < average * 0.7 && hour >= 14) {
      personal.push(`You are ${formatMinutes(average - trackedToday)} under your daily average. Protect that lead tonight and you will beat your week.`);
    }
    if (average !== null && trackedToday > average && top && top.minutes > 0) {
      personal.push(`${top.app} has taken ${formatMinutes(top.minutes)} today, more than your usual day. Next time you open it, say out loud why before you scroll.`);
    }
    if (stats.currentStreak >= 5) {
      personal.push(`${stats.currentStreak} wins in a row. The next challenge is where most streaks die. Decide now that you will leave in time.`);
    }
    if (stats.currentStreak === 0 && stats.totalChallenges > 0) {
      personal.push('Fresh start. Win the very next challenge and you are back in motion. One win is all it takes.');
    }
    if (stats.bestReactionTime > 0 && stats.bestReactionTime > 4) {
      personal.push(`Your best exit is ${stats.bestReactionTime.toFixed(1)}s. Try to beat it today: the moment the challenge lands, press home first and think later.`);
    }
    if (hour >= 21) {
      personal.push('Late-night scrolling steals tomorrow\'s focus. Charge your phone outside the bedroom tonight.');
    } else if (hour < 11) {
      personal.push('Do not open a feed in your first hour awake. The day you protect in the morning is the day you keep.');
    }

    const pool = personal.length ? personal : GENERAL;
    return pool[daySeed() % pool.length];
  }, [screenTime, tracked, week, trackedToday, stats]);

  if (!isPro) {
    return (
      <TouchableOpacity style={[styles.card, styles.cardLocked]} onPress={onUnlock} activeOpacity={0.85}>
        <View style={styles.head}>
          <Text style={styles.kicker}>PRO COACH</Text>
          <Text style={styles.lock}>🔒</Text>
        </View>
        <Text style={styles.lockedText}>A personal tip every day, built from your own screen time and streak.</Text>
        <Text style={styles.unlock}>HOW TO GET PRO →</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker}>PRO COACH · TODAY</Text>
        <Text style={styles.badge}>◆</Text>
      </View>
      <Text style={styles.tip}>{tip}</Text>
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
  },
  cardLocked: { backgroundColor: c.surface, borderColor: c.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  kicker: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  badge: { color: c.accent, fontSize: 14, fontWeight: '900' },
  lock: { fontSize: 13 },
  tip: { color: c.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  lockedText: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  unlock: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, marginTop: spacing.md },
});
