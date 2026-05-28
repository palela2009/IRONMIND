import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { UserStats } from '../types/training';

interface RsltProps {
  elapsedTime: number;
  stats: UserStats;
  onNavigate: (state: any) => void;
}

export const RsltScreen: React.FC<RsltProps> = ({ elapsedTime, stats, onNavigate }) => {
  const netXP = 60;
  const t = elapsedTime > 0 ? elapsedTime : 5.01;

  const grade = t < 0.8 ? 'S' : t < 1.5 ? 'A' : t < 3 ? 'B' : 'C';
  const gradeColor = grade === 'S' ? '#CCFF00' : grade === 'A' ? '#FFFFFF' : grade === 'B' ? '#888888' : '#555555';

  return (
    <View style={styles.container}>
      <View style={styles.tag}>
        <Text style={styles.tagText}>REP COMPLETE</Text>
      </View>

      <View style={styles.hero}>
        <Text style={[styles.grade, { color: gradeColor }]}>{grade}</Text>
        <View style={styles.timeBlock}>
          <Text style={styles.timeValue}>
            {t.toFixed(2)}<Text style={styles.timeUnit}>s</Text>
          </Text>
          <Text style={styles.timeLabel}>TIME TO CLOSE</Text>
        </View>
      </View>

      <View style={styles.xpCard}>
        <Text style={styles.cardLabel}>XP BREAKDOWN</Text>
        <View style={styles.xpLine}>
          <Text style={styles.xpLineLabel}>Closed in time</Text>
          <Text style={styles.xpLineVal}>+50</Text>
        </View>
        <View style={styles.xpLine}>
          <Text style={styles.xpLineLabel}>Streak bonus</Text>
          <Text style={styles.xpLineVal}>+10</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.xpLine}>
          <Text style={styles.xpTotalLabel}>Net XP earned</Text>
          <Text style={styles.xpTotalVal}>+{netXP}</Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.endBtn} onPress={() => onNavigate('HOME')}>
          <Text style={styles.endBtnText}>END SET</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={() => onNavigate('ARM')}>
          <Text style={styles.nextBtnText}>NEXT REP →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808', paddingHorizontal: 24, justifyContent: 'center' },

  tag: {
    backgroundColor: '#0B1800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#253300',
  },
  tagText: { color: '#CCFF00', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

  hero: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 40 },
  grade: { fontSize: 120, fontWeight: '900', lineHeight: 130 },
  timeBlock: {},
  timeValue: { color: '#FFFFFF', fontSize: 52, fontWeight: '900' },
  timeUnit: { color: '#444444', fontSize: 22, fontWeight: '700' },
  timeLabel: { color: '#444444', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },

  xpCard: {
    backgroundColor: '#111113',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E1E21',
    marginBottom: 48,
  },
  cardLabel: { color: '#3A3A3E', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 16 },
  xpLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  xpLineLabel: { color: '#777777', fontSize: 14, fontWeight: '500' },
  xpLineVal: { color: '#CCFF00', fontSize: 14, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1A1A1D', marginVertical: 8 },
  xpTotalLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  xpTotalVal: { color: '#CCFF00', fontSize: 15, fontWeight: '900' },

  btnRow: { flexDirection: 'row', gap: 10 },
  endBtn: {
    flex: 0.45,
    backgroundColor: '#111113',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E21',
  },
  endBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  nextBtn: { flex: 1, backgroundColor: '#CCFF00', paddingVertical: 20, borderRadius: 16, alignItems: 'center' },
  nextBtnText: { color: '#000000', fontSize: 14, fontWeight: '900' },
});
