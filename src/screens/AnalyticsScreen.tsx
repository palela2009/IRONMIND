import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';
import { useAnalytics, dayLabel, trendFor } from '../hooks/useAnalytics';
import { formatMinutes } from '../hooks/useScreenTime';
import { colorForApp, abbrForApp } from '../constants/apps';
import { ChallengeItem, UserStats } from '../types/training';

interface Props {
  visible: boolean;
  onClose: () => void;
  history: ChallengeItem[];
  stats: UserStats;
}

const RANGES = [7, 14, 30] as const;

export const AnalyticsScreen: React.FC<Props> = ({ visible, onClose, history, stats }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();
  const [days, setDays] = useState<number>(14);
  const { history: usage, loading } = useAnalytics(30);

  const window = useMemo(() => usage.slice(-days), [usage, days]);

  const totals = useMemo(() => {
    const mins = window.map((d) => d.total);
    const sum = mins.reduce((a, b) => a + b, 0);
    return {
      sum,
      avg: window.length > 0 ? sum / window.length : 0,
      peak: window.length > 0 ? Math.max(...mins) : 0,
      trend: trendFor(mins),
    };
  }, [window]);

  const topApps = useMemo(() => {
    const totalsByApp = new Map<string, number>();
    for (const day of window) {
      for (const a of day.apps) {
        totalsByApp.set(a.app, (totalsByApp.get(a.app) ?? 0) + a.minutes);
      }
    }
    return [...totalsByApp.entries()]
      .map(([app, minutes]) => ({ app, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [window]);

  const challengeStats = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = history.filter((h) => h.timestamp >= cutoff);
    const wins = recent.filter((h) => h.wasSuccessful);
    const times = wins.filter((h) => h.elapsedTime > 0).map((h) => h.elapsedTime);
    const byApp = new Map<string, { total: number; won: number }>();
    for (const h of recent) {
      const entry = byApp.get(h.targetApp) ?? { total: 0, won: 0 };
      entry.total += 1;
      if (h.wasSuccessful) entry.won += 1;
      byApp.set(h.targetApp, entry);
    }
    return {
      total: recent.length,
      wins: wins.length,
      rate: recent.length > 0 ? Math.round((wins.length / recent.length) * 100) : 0,
      avgTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      byApp: [...byApp.entries()]
        .map(([app, v]) => ({ app, ...v, rate: Math.round((v.won / v.total) * 100) }))
        .sort((a, b) => b.total - a.total),
    };
  }, [history, days]);

  const maxDay = Math.max(...window.map((d) => d.total), 1);
  const maxApp = topApps.length > 0 ? topApps[0].minutes : 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.title}>ANALYTICS</Text>

          <View style={styles.rangeRow}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeChip, days === r && styles.rangeChipOn]}
                onPress={() => setDays(r)}
                activeOpacity={0.85}
              >
                <Text style={[styles.rangeText, days === r && styles.rangeTextOn]}>{r}D</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={palette.accent} style={styles.loader} />
          ) : window.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>NO DATA YET</Text>
              <Text style={styles.emptySub}>
                Screen time is recorded each day you use IRONMIND. Come back tomorrow to see your
                first trend.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>DAILY AVERAGE</Text>
                <View style={styles.heroRow}>
                  <Text style={styles.hero}>{formatMinutes(totals.avg)}</Text>
                  {totals.trend.hasData && (
                    <View
                      style={[
                        styles.trendPill,
                        { backgroundColor: totals.trend.change <= 0 ? palette.accentMuted : palette.dangerMuted },
                      ]}
                    >
                      <Text
                        style={[
                          styles.trendText,
                          { color: totals.trend.change <= 0 ? palette.accent : palette.danger },
                        ]}
                      >
                        {totals.trend.change <= 0 ? '▼' : '▲'} {Math.abs(Math.round(totals.trend.change))}%
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSub}>
                  {totals.trend.hasData
                    ? totals.trend.change <= 0
                      ? 'Down versus the first half of this period. Keep going.'
                      : 'Up versus the first half of this period.'
                    : 'Not enough days yet to show a trend.'}
                </Text>

                <View style={styles.chart}>
                  {window.map((d) => (
                    <View key={d.date} style={styles.chartCol}>
                      <View style={styles.chartBarTrack}>
                        <View
                          style={[
                            styles.chartBar,
                            {
                              height: `${Math.max((d.total / maxDay) * 100, 2)}%`,
                              backgroundColor: d.total >= maxDay * 0.85 ? palette.danger : palette.accent,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.chartLabel}>{dayLabel(d.date)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statCell}>
                    <Text style={styles.statVal}>{formatMinutes(totals.sum)}</Text>
                    <Text style={styles.statLabel}>TOTAL</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statVal}>{formatMinutes(totals.peak)}</Text>
                    <Text style={styles.statLabel}>WORST DAY</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statVal}>{window.length}</Text>
                    <Text style={styles.statLabel}>DAYS LOGGED</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.section}>WHERE THE TIME GOES</Text>
              <View style={styles.card}>
                {topApps.length === 0 ? (
                  <Text style={styles.cardSub}>No app usage recorded in this period.</Text>
                ) : (
                  topApps.map((a) => (
                    <View key={a.app} style={styles.appRow}>
                      <View style={[styles.appIcon, { backgroundColor: colorForApp(a.app) }]}>
                        <Text style={styles.appIconText}>{abbrForApp(a.app)}</Text>
                      </View>
                      <Text style={styles.appName} numberOfLines={1}>{a.app}</Text>
                      <View style={styles.appBarTrack}>
                        <View
                          style={[
                            styles.appBar,
                            { width: `${Math.max((a.minutes / maxApp) * 100, 3)}%`, backgroundColor: colorForApp(a.app) },
                          ]}
                        />
                      </View>
                      <Text style={styles.appMins}>{formatMinutes(a.minutes)}</Text>
                    </View>
                  ))
                )}
              </View>

              <Text style={styles.section}>CHALLENGE PERFORMANCE</Text>
              <View style={styles.card}>
                <View style={styles.statRow}>
                  <View style={styles.statCell}>
                    <Text style={[styles.statVal, styles.accentVal]}>{challengeStats.rate}%</Text>
                    <Text style={styles.statLabel}>SUCCESS</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statVal}>{challengeStats.total}</Text>
                    <Text style={styles.statLabel}>CHALLENGES</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Text style={styles.statVal}>
                      {challengeStats.avgTime > 0 ? `${challengeStats.avgTime.toFixed(2)}s` : '—'}
                    </Text>
                    <Text style={styles.statLabel}>AVG EXIT</Text>
                  </View>
                </View>

                {challengeStats.byApp.length > 0 && <View style={styles.hairline} />}

                {challengeStats.byApp.map((a) => (
                  <View key={a.app} style={styles.perfRow}>
                    <Text style={styles.perfApp} numberOfLines={1}>{a.app}</Text>
                    <View style={styles.appBarTrack}>
                      <View
                        style={[
                          styles.appBar,
                          {
                            width: `${Math.max(a.rate, 3)}%`,
                            backgroundColor: a.rate >= 50 ? palette.accent : palette.danger,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.perfRate}>{a.rate}%</Text>
                    <Text style={styles.perfCount}>{a.won}/{a.total}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.section}>RECORDS</Text>
              <View style={styles.card}>
                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>Best exit</Text>
                  <Text style={styles.recordVal}>
                    {stats.bestReactionTime > 0 ? `${stats.bestReactionTime.toFixed(2)}s` : '—'}
                  </Text>
                </View>
                <View style={styles.hairline} />
                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>Longest run</Text>
                  <Text style={styles.recordVal}>{stats.longestStreak}</Text>
                </View>
                <View style={styles.hairline} />
                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>Lifetime challenges</Text>
                  <Text style={styles.recordVal}>{stats.totalChallenges}</Text>
                </View>
                <View style={styles.hairline} />
                <View style={styles.recordRow}>
                  <Text style={styles.recordLabel}>Lifetime success</Text>
                  <Text style={styles.recordVal}>
                    {stats.totalChallenges > 0
                      ? `${Math.round((stats.successCount / stats.totalChallenges) * 100)}%`
                      : '—'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.lg, paddingTop: 56, paddingBottom: 48 },

  close: { position: 'absolute', top: 52, right: spacing.lg, width: 36, height: 36, borderRadius: 18, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  title: { color: c.textPrimary, fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginBottom: spacing.lg },

  rangeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  rangeChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
  rangeChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  rangeText: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  rangeTextOn: { color: c.accentContrast },

  loader: { marginTop: spacing.xxxl },
  empty: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: c.border },
  emptyTitle: { color: c.textSecondary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: spacing.sm },
  emptySub: { color: c.textFaint, fontSize: 12, lineHeight: 17, textAlign: 'center' },

  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: c.border, marginBottom: spacing.lg, ...cardShadow },
  cardLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardSub: { color: c.textTertiary, fontSize: 11, lineHeight: 16, marginTop: 4 },

  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
  hero: { color: c.textPrimary, fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  trendPill: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  trendText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110, marginTop: spacing.xl },
  chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartBarTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 3, minHeight: 2 },
  chartLabel: { color: c.textFaint, fontSize: 8, fontWeight: '800', marginTop: 4 },

  statRow: { flexDirection: 'row', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderColor: c.borderSubtle },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: c.textPrimary, fontSize: 15, fontWeight: '900' },
  accentVal: { color: c.accent },
  statLabel: { color: c.textFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: c.borderSubtle },

  section: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.md, marginTop: spacing.xs },

  appRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  appIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  appIconText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  appName: { color: c.textSecondary, fontSize: 12, fontWeight: '700', width: 72 },
  appBarTrack: { flex: 1, height: 6, backgroundColor: c.surfaceRaised, borderRadius: 3, overflow: 'hidden' },
  appBar: { height: '100%', borderRadius: 3 },
  appMins: { color: c.textPrimary, fontSize: 11, fontWeight: '900', width: 52, textAlign: 'right' },

  hairline: { height: 1, backgroundColor: c.borderSubtle, marginVertical: spacing.md },

  perfRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  perfApp: { color: c.textSecondary, fontSize: 12, fontWeight: '700', width: 72 },
  perfRate: { color: c.textPrimary, fontSize: 11, fontWeight: '900', width: 34, textAlign: 'right' },
  perfCount: { color: c.textFaint, fontSize: 10, fontWeight: '700', width: 42, textAlign: 'right' },

  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recordLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  recordVal: { color: c.accent, fontSize: 15, fontWeight: '900' },
});
