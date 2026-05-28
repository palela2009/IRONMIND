import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { UserStats, RepHistoryItem } from '../types/training';

interface StatsProps {
  stats: UserStats;
  history: RepHistoryItem[];
  onNavigate: (state: any) => void;
}

const BARS = [30, 55, 20, 80, 45, 100, 38];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const GRID = [
  [0, 1, 1, 0, 1, 1, 0, 1, 0],
  [1, 0, 1, 1, 1, 0, 1, 1, 1],
  [1, 1, 0, 1, 1, 1, 0, 1, 0],
  [0, 1, 1, 1, 0, 1, 1, 1, 1],
];

const RECORDS = [
  { title: 'Fastest close', meta: 'Instagram · 3 days ago', getValue: (s: UserStats) => `${s.bestReactionTime.toFixed(2)}s` },
  { title: 'Longest streak', meta: 'Apr 18 — Apr 30', getValue: (s: UserStats) => `${s.longestStreak} days` },
  { title: 'Most reps in a day', meta: 'last Tuesday', getValue: () => '23' },
];

export const StatsScreen: React.FC<StatsProps> = ({ stats, onNavigate }) => {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backRow} onPress={() => onNavigate('HOME')}>
        <Text style={styles.backText}>← BACK</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>PROGRESS</Text>
      <Text style={styles.headline}>
        You've gotten{'\n'}<Text style={styles.accent}>2.4× faster</Text>
      </Text>
      <Text style={styles.sub}>vs. your first week of training</Text>

      <View style={styles.card}>
        <View style={styles.chartHead}>
          <View>
            <Text style={styles.cardLabel}>THIS WEEK</Text>
            <Text style={styles.cardBigVal}>42 reps</Text>
          </View>
          <View style={styles.chartHeadRight}>
            <Text style={styles.cardLabel}>AVG REACT</Text>
            <Text style={[styles.cardBigVal, styles.accent]}>1.4s</Text>
          </View>
        </View>
        <View style={styles.barChart}>
          {BARS.map((h, i) => (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, { height: h }, i === 5 && styles.barHighlight]} />
              <Text style={[styles.dayLabel, i === 5 && styles.dayLabelHighlight]}>{DAYS[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.gridHead}>
          <Text style={styles.cardLabel}>ACTIVITY · LAST 36 DAYS</Text>
          <Text style={styles.streakVal}>{stats.currentStreak}d streak</Text>
        </View>
        <View style={styles.grid}>
          {GRID.map((row, ri) => (
            <View key={ri} style={styles.gridRow}>
              {row.map((on, ci) => (
                <View key={ci} style={[styles.gridCell, on === 1 && styles.gridCellOn]} />
              ))}
            </View>
          ))}
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>less</Text>
          <View style={styles.legend}>
            {[0, 0.25, 0.55, 1].map((op, i) => (
              <View
                key={i}
                style={[
                  styles.legendCell,
                  { backgroundColor: op === 0 ? '#1A1A1D' : `rgba(204,255,0,${op})` },
                ]}
              />
            ))}
          </View>
          <Text style={styles.legendText}>more</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>PERSONAL RECORDS</Text>

      {RECORDS.map((rec) => (
        <View key={rec.title} style={styles.recordCard}>
          <View>
            <Text style={styles.recTitle}>{rec.title}</Text>
            <Text style={styles.recMeta}>{rec.meta}</Text>
          </View>
          <Text style={styles.recVal}>{rec.getValue(stats)}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  content: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 40 },

  backRow: { marginBottom: 20 },
  backText: { color: '#555555', fontSize: 12, fontWeight: '800' },

  eyebrow: { color: '#444444', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  headline: { color: '#FFFFFF', fontSize: 36, fontWeight: '900', lineHeight: 44, marginBottom: 4 },
  accent: { color: '#CCFF00' },
  sub: { color: '#555555', fontSize: 14, marginBottom: 24 },

  card: {
    backgroundColor: '#111113',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E1E21',
    marginBottom: 12,
  },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  chartHeadRight: { alignItems: 'flex-end' },
  cardLabel: { color: '#444444', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardBigVal: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 3 },

  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: 20, backgroundColor: '#1C1C1F', borderRadius: 4 },
  barHighlight: { backgroundColor: '#CCFF00' },
  dayLabel: { color: '#3A3A3E', fontSize: 10, fontWeight: '700' },
  dayLabelHighlight: { color: '#CCFF00' },

  gridHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  streakVal: { color: '#CCFF00', fontSize: 11, fontWeight: '800' },
  grid: { gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  gridCell: { flex: 1, aspectRatio: 1, borderRadius: 5, backgroundColor: '#1A1A1D' },
  gridCellOn: { backgroundColor: '#CCFF00' },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  legendText: { color: '#3A3A3E', fontSize: 10 },
  legend: { flexDirection: 'row', gap: 4 },
  legendCell: { width: 16, height: 16, borderRadius: 3 },

  sectionLabel: { color: '#444444', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 12, marginTop: 10 },
  recordCard: {
    backgroundColor: '#111113',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E1E21',
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  recMeta: { color: '#444444', fontSize: 12, marginTop: 3 },
  recVal: { color: '#CCFF00', fontSize: 22, fontWeight: '900' },
});
