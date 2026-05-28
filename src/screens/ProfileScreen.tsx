import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { UserStats } from '../types/training';

interface ProfileProps {
  stats: UserStats;
  onNavigate: (state: any) => void;
}

const ACHIEVEMENTS = [
  { id: '01', title: 'FIRST BLOOD', desc: 'Closed your first trigger', done: true },
  { id: '02', title: 'SUB-SECOND', desc: 'React in under 1.00s', done: true },
  { id: '03', title: 'WEEK ONE', desc: '7-day streak unbroken', done: true },
  { id: '04', title: 'IRON DISCIPLINE', desc: '30-day streak', done: false },
  { id: '05', title: 'CENTURY', desc: '100 lifetime reps', done: true },
  { id: '06', title: 'NIGHT OWL', desc: 'Kill a trigger after midnight', done: true },
  { id: '07', title: 'STONE HANDS', desc: 'Zero fails in a week', done: false },
  { id: '08', title: 'MARATHON', desc: '500 lifetime reps', done: false },
];

const SETTINGS = [
  { label: 'TRIGGER POOL', value: '4 APPS' },
  { label: 'DAILY GOAL', value: '10 REPS' },
  { label: 'RESISTANCE LEVEL', value: 'INTERMEDIATE' },
  { label: 'NOTIFICATIONS', value: 'ON' },
  { label: 'ACCOUNT · DATA', value: '→' },
];

export const ProfileScreen: React.FC<ProfileProps> = ({ stats, onNavigate }) => {
  const doneCount = ACHIEVEMENTS.filter((a) => a.done).length;
  const rankPct = (stats.currentXP / 500) * 100;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('HOME')}>
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE · ATHLETE LOG</Text>
        <Text style={styles.settingsGlyph}>⚙</Text>
      </View>

      <View style={styles.athleteCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.athleteBadge}>
            <Text style={styles.athleteBadgeText}>ATHLETE</Text>
          </View>
          <Text style={styles.athleteNo}>NO. 00843 / IM</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarLetters}>NK</Text>
            <View style={styles.avatarDiag} />
          </View>
          <View style={styles.athleteDetails}>
            <Text style={styles.handleText}>NIKA.K</Text>
            <Text style={styles.weightText}>FEATHER · #20KG</Text>
            <View style={styles.threeStats}>
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.level}</Text>
                <Text style={styles.tStatLabel}>LV</Text>
              </View>
              <View style={styles.tStatLine} />
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>{stats.currentStreak}</Text>
                <Text style={styles.tStatLabel}>STREAK</Text>
              </View>
              <View style={styles.tStatLine} />
              <View style={styles.tStat}>
                <Text style={styles.tStatVal}>26</Text>
                <Text style={styles.tStatLabel}>JOINED</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.rankLabelRow}>
        <Text style={styles.rankLabel}>RANK PROGRESS</Text>
        <Text style={styles.rankNext}>→ LIGHT @ LV.5</Text>
      </View>
      <View style={styles.rankBarBg}>
        <View style={[styles.rankBarFill, { width: `${rankPct}%` }]} />
      </View>

      <View style={styles.quickRow}>
        {[
          { label: 'TOTAL REPS', val: String(stats.totalReps) },
          { label: 'BEST RXN', val: `${stats.bestReactionTime.toFixed(2)}s`, accent: true },
          { label: 'HRS SAVED', val: '38h' },
          { label: 'FAILS', val: '9' },
        ].map((s) => (
          <View key={s.label} style={styles.quickStat}>
            <Text style={[styles.quickStatVal, s.accent && styles.accentVal]}>{s.val}</Text>
            <Text style={styles.quickStatLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        <Text style={styles.achieveCount}>{doneCount} / {ACHIEVEMENTS.length}</Text>
      </View>

      <View style={styles.achieveGrid}>
        {ACHIEVEMENTS.map((a) => (
          <View key={a.id} style={[styles.achieveCard, !a.done && styles.achieveCardLocked]}>
            <View style={styles.achieveTopRow}>
              <Text style={[styles.achieveId, a.done && styles.achieveIdDone]}>#{a.id}</Text>
              {a.done && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={[styles.achieveTitle, !a.done && styles.achieveTitleLocked]}>{a.title}</Text>
            <Text style={styles.achieveDesc}>{a.desc}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.settingsSection}>SETTINGS</Text>
      {SETTINGS.map((s) => (
        <TouchableOpacity key={s.label} style={styles.settingRow}>
          <Text style={styles.settingLabel}>{s.label}</Text>
          <Text style={styles.settingValue}>{s.value}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.settingRow}>
        <Text style={styles.signOut}>SIGN OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
  },
  backText: { color: '#555555', fontSize: 11, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  settingsGlyph: { color: '#555555', fontSize: 16 },

  athleteCard: {
    backgroundColor: '#111111',
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  athleteBadge: { backgroundColor: '#CCFF00', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  athleteBadgeText: { color: '#000000', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  athleteNo: { color: '#444444', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  cardBody: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  avatarBox: {
    width: 80,
    height: 80,
    backgroundColor: '#CCFF00',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarLetters: { color: '#000000', fontSize: 28, fontWeight: '900', zIndex: 1 },
  avatarDiag: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 110,
    backgroundColor: 'rgba(0,0,0,0.12)',
    transform: [{ rotate: '18deg' }],
  },
  athleteDetails: { flex: 1 },
  handleText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  weightText: { color: '#666666', fontSize: 11, fontWeight: '600', marginBottom: 10 },
  threeStats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tStat: { alignItems: 'center' },
  tStatVal: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  tStatLabel: { color: '#444444', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  tStatLine: { width: 1, height: 22, backgroundColor: '#222222' },

  rankLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  rankLabel: { color: '#444444', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rankNext: { color: '#CCFF00', fontSize: 10, fontWeight: '800' },
  rankBarBg: { height: 4, backgroundColor: '#1A1A1A', marginHorizontal: 20, marginBottom: 24, overflow: 'hidden' },
  rankBarFill: { height: '100%', backgroundColor: '#CCFF00' },

  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  quickStat: {},
  quickStatVal: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  quickStatLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  accentVal: { color: '#CCFF00' },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  achieveCount: { color: '#CCFF00', fontSize: 12, fontWeight: '800' },

  achieveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 36,
  },
  achieveCard: {
    width: '48%',
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1C1C1C',
  },
  achieveCardLocked: { opacity: 0.4 },
  achieveTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  achieveId: { color: '#333333', fontSize: 10, fontWeight: '800' },
  achieveIdDone: { color: '#CCFF00' },
  checkMark: { color: '#CCFF00', fontSize: 12, fontWeight: '900' },
  achieveTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  achieveTitleLocked: { color: '#444444' },
  achieveDesc: { color: '#444444', fontSize: 10, lineHeight: 14 },

  settingsSection: {
    color: '#444444',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: '#141414',
  },
  settingLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  settingValue: { color: '#666666', fontSize: 13, fontWeight: '600' },
  signOut: { color: '#FF1133', fontSize: 13, fontWeight: '900' },
});
