import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { UserStats, RepHistoryItem } from '../types/training';
import { useAuth } from '../context/AuthContext'; 

interface HomeProps {
  stats: UserStats;
  history: RepHistoryItem[];
  onNavigate: (state: any) => void;
}

const BARS = [18, 45, 12, 72, 38, 88, 100];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const timeAgo = (ts: number) => {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 60) return `${mins} MIN`;
  return `${Math.floor(mins / 60)} HR`;
};

export const HomeScreen: React.FC<HomeProps> = ({ stats, history, onNavigate }) => {
  const { fbUser } = useAuth(); 
  
  const displayHistory: RepHistoryItem[] = history.length > 0 ? history : [
    { id: '842', targetApp: 'INSTAGRAM', elapsedTime: 0.84, timestamp: Date.now() - 120000, xpEarned: 50, wasSuccessful: true },
    { id: '841', targetApp: 'TIKTOK', elapsedTime: 2.10, timestamp: Date.now() - 840000, xpEarned: 35, wasSuccessful: true },
    { id: '840', targetApp: 'YOUTUBE', elapsedTime: 3.40, timestamp: Date.now() - 2820000, xpEarned: 15, wasSuccessful: true },
    { id: '839', targetApp: 'INSTAGRAM', elapsedTime: 5.8, timestamp: Date.now() - 3820000, xpEarned: 0, wasSuccessful: false },
  ];

  const xpToNext = 500 - stats.currentXP;
  const xpPct = Math.min((stats.currentXP / 500) * 100, 100);
  const streakStr = String(stats.currentStreak).padStart(2, '0');

 
  const getInitials = () => {
    if (fbUser?.displayName) {
      return fbUser.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'IM';
  };

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      data={displayHistory}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={() => (
        <>
          <View style={styles.header}>
            <View style={styles.brand}>
              <View style={styles.logoBox}>
                <View style={styles.logoBars}>
                  <View style={[styles.logoBar, { height: 7 }]} />
                  <View style={[styles.logoBar, { height: 13 }]} />
                  <View style={[styles.logoBar, { height: 10 }]} />
                </View>
              </View>
              <Text style={styles.brandName}>IRONMIND</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.dateText}>MAY 28</Text>
              
              
              <TouchableOpacity style={styles.avatarBtn} onPress={() => onNavigate('PROFILE')}>
                {fbUser?.photoURL ? (
                  <Image source={{ uri: fbUser.photoURL }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarBtnText}>{getInitials()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.metaLine}>
            WK 03 · DAY {streakStr} · UNBROKEN
          </Text>

          <View style={styles.heroRow}>
            <Text style={styles.heroNum}>{streakStr}</Text>
            <TouchableOpacity style={styles.heroArrowBtn} >
              <Text style={styles.heroArrowText}>↗</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.streakLabelRow}>
            <Text style={styles.streakLabel}>DAY STREAK · LONGEST YET</Text>
            <View style={styles.lvBadge}>
              <Text style={styles.lvText}>LV.{stats.level}</Text>
            </View>
          </View>

          <View style={styles.xpLabelRow}>
            <Text style={styles.xpLabel}>XP {stats.currentXP} / 500</Text>
            <Text style={styles.xpNext}>NEXT: {xpToNext}XP TO LV.{stats.level + 1}</Text>
          </View>
          <View style={styles.xpBarBg}>
            <View style={[styles.xpBarFill, { width: `${xpPct}%` }]} />
          </View>

          <TouchableOpacity style={styles.beginCard} onPress={() => onNavigate('ARM')} activeOpacity={0.88}>
            <View style={styles.beginLeft}>
              <Text style={styles.beginTag}>BEGIN SESSION  +</Text>
              <Text style={styles.beginTitle}>TRAIN{'\n'}YOUR{'\n'}REFLEX.</Text>
              <Text style={styles.beginSub}>~60s · 1 trigger fires · close it 5s</Text>
            </View>
            <View style={styles.beginArrow}>
              <Text style={styles.beginArrowText}>↗</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartLabel}>THIS WEEK · REPS</Text>
              <Text style={styles.chartTotal}>42 TOTAL</Text>
            </View>
            <View style={styles.barChart}>
              {BARS.map((h, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={[
                    styles.bar,
                    { height: Math.max((h / 100) * 80, 4) },
                    i === BARS.length - 1 && styles.barToday,
                  ]} />
                  <Text style={[styles.dayLabel, i === BARS.length - 1 && styles.dayToday]}>
                    {DAYS[i]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.quickRow}>
            <View style={styles.quickCell}>
              <Text style={styles.quickVal}>6<Text style={styles.quickUnit}>/D</Text></Text>
              <Text style={styles.quickLabel}>TODAY</Text>
            </View>
            <View style={styles.quickDivider} />
            <View style={styles.quickCell}>
              <Text style={[styles.quickVal, styles.accentVal]}>
                {stats.bestReactionTime.toFixed(2)}<Text style={styles.quickUnit}>s</Text>
              </Text>
              <Text style={styles.quickLabel}>BEST RXN</Text>
            </View>
            <View style={styles.quickDivider} />
            <View style={styles.quickCell}>
              <Text style={styles.quickVal}>{stats.totalReps}</Text>
              <Text style={styles.quickLabel}>LIFETIME</Text>
            </View>
          </View>

          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>RECENT REPS</Text>
            <TouchableOpacity onPress={() => onNavigate('STATS')}>
              <Text style={styles.fullLog}>FULL LOG ↗</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      renderItem={({ item }) => (
        <View style={styles.repRow}>
          <Text style={styles.repNum}>#{item.id}</Text>
          <Text style={styles.repApp}>{item.targetApp}</Text>
          <Text style={styles.repTime}>{timeAgo(item.timestamp)}</Text>
          {item.wasSuccessful ? (
            <Text style={styles.repReact}>{item.elapsedTime.toFixed(2)}s</Text>
          ) : (
            <Text style={styles.repFail}>FAIL</Text>
          )}
        </View>
      )}
      ItemSeparatorComponent={() => <View style={styles.repDivider} />}
    />
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingTop: 50, paddingBottom: 30 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBox: { backgroundColor: '#CCFF00', width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  logoBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  logoBar: { width: 3.5, backgroundColor: '#000000', borderRadius: 1.5 },
  brandName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dateText: { color: '#555555', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  
  avatarBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCFF00', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarBtnText: { color: '#000000', fontSize: 10, fontWeight: '900' },

  metaLine: { color: '#555555', fontSize: 10, fontWeight: '800', letterSpacing: 1, paddingHorizontal: 20 },

  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20 },
  heroNum: { color: '#FFFFFF', fontSize: 118, fontWeight: '900', letterSpacing: -6, lineHeight: 118 },
  heroArrowBtn: { marginTop: 14, width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: '#CCFF00', justifyContent: 'center', alignItems: 'center' },
  heroArrowText: { color: '#CCFF00', fontSize: 15 },

  streakLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  streakLabel: { color: '#777777', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  lvBadge: { borderWidth: 1, borderColor: '#CCFF00', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3 },
  lvText: { color: '#CCFF00', fontSize: 11, fontWeight: '900' },

  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 },
  xpLabel: { color: '#555555', fontSize: 11, fontWeight: '600' },
  xpNext: { color: '#CCFF00', fontSize: 11, fontWeight: '700' },
  xpBarBg: { height: 3, backgroundColor: '#1A1A1A', marginHorizontal: 20, marginBottom: 20, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: '#CCFF00' },

  beginCard: {
    backgroundColor: '#CCFF00',
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  beginLeft: { flex: 1 },
  beginTag: { color: '#000000', fontSize: 10, fontWeight: '800', opacity: 0.55, letterSpacing: 0.5, marginBottom: 6 },
  beginTitle: { color: '#000000', fontSize: 40, fontWeight: '900', letterSpacing: -1, lineHeight: 42, marginBottom: 10 },
  beginSub: { color: '#000000', fontSize: 11, fontWeight: '600', opacity: 0.55 },
  beginArrow: { width: 44, height: 44, backgroundColor: '#000000', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  beginArrowText: { color: '#CCFF00', fontSize: 20, fontWeight: '900' },

  chartSection: { paddingHorizontal: 20, marginBottom: 4 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  chartLabel: { color: '#555555', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  chartTotal: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 94, justifyContent: 'space-between' },
  barCol: { flex: 1, alignItems: 'center', gap: 7 },
  bar: { width: 26, backgroundColor: '#1C1C1C', borderRadius: 3 },
  barToday: { backgroundColor: '#CCFF00' },
  dayLabel: { color: '#3A3A3A', fontSize: 10, fontWeight: '700' },
  dayToday: { color: '#CCFF00' },

  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#141414',
  },
  quickCell: { flex: 1, alignItems: 'center' },
  quickDivider: { width: 1, backgroundColor: '#1A1A1A', marginVertical: 4 },
  quickVal: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -1 },
  quickUnit: { fontSize: 13, color: '#555555', fontWeight: '700' },
  quickLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 3 },
  accentVal: { color: '#CCFF00' },

  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 4 },
  recentTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  fullLog: { color: '#CCFF00', fontSize: 11, fontWeight: '700' },

  repRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  repNum: { color: '#333333', fontSize: 10, fontWeight: '700', width: 38 },
  repApp: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  repTime: { color: '#444444', fontSize: 11, fontWeight: '600', marginRight: 12, width: 42, textAlign: 'right' },
  repReact: { color: '#CCFF00', fontSize: 14, fontWeight: '900', width: 46, textAlign: 'right' },
  repFail: { color: '#FF1133', fontSize: 12, fontWeight: '900', width: 46, textAlign: 'right' },
  repDivider: { height: 1, backgroundColor: '#111111', marginHorizontal: 20 },
});