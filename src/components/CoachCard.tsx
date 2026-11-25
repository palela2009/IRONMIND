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
  'The algorithm spent billions trying to keep your thumb moving. One exit breaks the spell.',
  'Boredom is not an emergency. Wait 60 seconds before unlocking and watch the urge evaporate.',
  'Put your phone across the room for the next hour. Distance beats willpower every single time.',
  'Your fastest exits happen when you decide why you opened an app before tapping the icon.',
  'Mute non-human notifications today. Let people reach you, not engagement loops.',
  'Pick one annoying 10-minute task and finish it before you earn your next scroll.',
  'Turn on Bedtime grayscale tonight — a monochrome feed loses half its pull instantly.',
];

const daySeed = (): number => {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
};

const gradeFor = (winRate: number, streak: number, underAvg: boolean): { letter: string; label: string } => {
  const score = winRate * 0.6 + Math.min(streak * 3, 25) + (underAvg ? 15 : 0);
  if (score >= 85) return { letter: 'S', label: 'LOCKED IN' };
  if (score >= 70) return { letter: 'A', label: 'SHARP' };
  if (score >= 50) return { letter: 'B', label: 'STEADY' };
  if (score >= 30) return { letter: 'C', label: 'WARMING UP' };
  return { letter: 'D', label: 'REBUILDING' };
};

export const CoachCard: React.FC<Props> = ({ isPro, stats, onUnlock }) => {
  const styles = useThemedStyles(makeStyles);
  const { screenTime, tracked, week, trackedToday } = useScreenTime();

  const report = useMemo(() => {
    const hour = new Date().getHours();
    const past7 = week.filter((w) => w.date < todayKey()).slice(-7);
    const pastMins = past7.map((w) => trackedTotal(w.apps, tracked));
    const average = pastMins.length ? pastMins.reduce((a, b) => a + b, 0) / pastMins.length : null;
    const top = tracked
      .map((app) => ({ app, minutes: screenTime.find((s) => s.app === app)?.minutes ?? 0 }))
      .sort((a, b) => b.minutes - a.minutes)[0];

    const personal: string[] = [];
    if (average !== null && trackedToday < average * 0.75 && hour >= 13) {
      personal.push(`You're ${formatMinutes(average - trackedToday)} under your 7-day average. Protect that lead tonight.`);
    }
    if (average !== null && trackedToday > average && top && top.minutes > 0) {
      personal.push(`${top.app} took ${formatMinutes(top.minutes)} today — above your usual pace. Close it on the very next alert.`);
    }
    if (stats.bestReactionTime > 0 && stats.bestReactionTime < 1.8) {
      personal.push(`${stats.bestReactionTime.toFixed(2)}s record exit. The feed didn't even finish loading.`);
    }
    if (stats.currentStreak >= 5) {
      personal.push(`${stats.currentStreak} straight wins. Most streaks break when people get cocky — stay sharp on the next pop.`);
    }
    if (stats.currentStreak === 0 && stats.totalChallenges > 0) {
      personal.push('Clean slate. Win the very next challenge and the momentum clicks right back on.');
    }
    if (hour >= 22) {
      personal.push('Late-night scrolling taxes tomorrow morning. Plug your phone in across the room.');
    } else if (hour < 10) {
      personal.push('Protect your first hour awake. Win the morning and the afternoon gets twice as easy.');
    }

    const pool = personal.length ? personal : GENERAL;
    const tip = pool[daySeed() % pool.length];
    const winRate = stats.totalChallenges > 0 ? Math.round((stats.successCount / stats.totalChallenges) * 100) : 0;
    const underAvg = average !== null ? trackedToday <= average : true;
    const grade = gradeFor(winRate, stats.currentStreak, underAvg);

    const weekAppTotals = new Map<string, number>();
    for (const day of past7) {
      for (const a of day.apps) {
        if (tracked.includes(a.app)) weekAppTotals.set(a.app, (weekAppTotals.get(a.app) ?? 0) + a.minutes);
      }
    }
    const kryptonite = [...weekAppTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? top?.app ?? 'None yet';

    return { tip, grade, kryptonite, winRate };
  }, [screenTime, tracked, week, trackedToday, stats]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.kicker}>IRONMIND COACH · TODAY</Text>
        <View style={styles.liveDotWrap}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <Text style={styles.tip}>{report.tip}</Text>

      {isPro ? (
        <View style={styles.fightCard}>
          <View style={styles.gradeBox}>
            <Text style={styles.gradeLetter}>{report.grade.letter}</Text>
            <Text style={styles.gradeLabel}>{report.grade.label}</Text>
          </View>
          <View style={styles.fightMeta}>
            <View style={styles.fightRow}>
              <Text style={styles.fightKey}>KRYPTONITE</Text>
              <Text style={styles.fightVal} numberOfLines={1}>{report.kryptonite}</Text>
            </View>
            <View style={styles.fightRow}>
              <Text style={styles.fightKey}>WIN RATE</Text>
              <Text style={styles.fightVal}>{stats.totalChallenges > 0 ? `${report.winRate}%` : '—'}</Text>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.proStrip} onPress={onUnlock} activeOpacity={0.85}>
          <Text style={styles.proStripText}>Unlock Weekly Fight Grade & Kryptonite App with Pro</Text>
          <Text style={styles.proStripCta}>PRO →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  kicker: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  liveDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
  liveText: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  tip: { color: c.textPrimary, fontSize: 14, lineHeight: 21, fontWeight: '700' },

  fightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
  },
  gradeBox: {
    width: 62,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    alignItems: 'center',
  },
  gradeLetter: { color: c.accent, fontSize: 22, fontWeight: '900', lineHeight: 24 },
  gradeLabel: { color: c.textSecondary, fontSize: 9, fontWeight: '900', letterSpacing: 0.4, marginTop: 2 },
  fightMeta: { flex: 1, gap: 6 },
  fightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fightKey: { color: c.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  fightVal: { color: c.textPrimary, fontSize: 12, fontWeight: '900', maxWidth: '60%' },

  proStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
  },
  proStripText: { flex: 1, color: c.textTertiary, fontSize: 11, fontWeight: '600' },
  proStripCta: { color: c.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
