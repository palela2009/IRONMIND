import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ArmProps {
  onNavigate: (state: any) => void;
}

const APPS = [
  { short: 'IG', name: 'Instagram' },
  { short: 'TT', name: 'TikTok' },
  { short: 'YT', name: 'YouTube' },
  { short: 'X', name: 'Twitter' },
];

export const ArmScreen: React.FC<ArmProps> = ({ onNavigate }) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => onNavigate('HOME')}>
          <Text style={styles.cancelText}>← CANCEL</Text>
        </TouchableOpacity>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SESSION ACTIVE</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>PROGRESSIVE OVERLOAD</Text>
        <Text style={styles.headline}>Put your phone{'\n'}down. Live your life.</Text>
        <Text style={styles.bodyText}>
          Within the next 60 seconds, a social app will open on its own. The moment you see it — close it. Faster reaction = more XP.
        </Text>

        <Text style={styles.poolLabel}>TRIGGER POOL</Text>
        <View style={styles.poolRow}>
          {APPS.map((app) => (
            <View key={app.short} style={styles.poolItem}>
              <Text style={styles.poolShort}>{app.short}</Text>
              <Text style={styles.poolName}>{app.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.armBtn} onPress={() => onNavigate('WAIT')} activeOpacity={0.85}>
        <Text style={styles.armBtnMain}>ARM TRIGGER</Text>
        <Text style={styles.armBtnSub}>I'M READY · LET'S GO</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelText: { color: '#555555', fontSize: 12, fontWeight: '800' },
  badge: {
    backgroundColor: '#161618',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#222225',
  },
  badgeText: { color: '#555555', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  body: { flex: 1, justifyContent: 'center', paddingVertical: 32 },
  eyebrow: { color: '#CCFF00', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16 },
  headline: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', lineHeight: 50, marginBottom: 20 },
  bodyText: { color: '#555555', fontSize: 15, lineHeight: 26, fontWeight: '400', marginBottom: 40 },

  poolLabel: { color: '#3A3A3E', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 14 },
  poolRow: { flexDirection: 'row', gap: 10 },
  poolItem: {
    flex: 1,
    backgroundColor: '#111113',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E21',
  },
  poolShort: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  poolName: { color: '#3A3A3E', fontSize: 9, fontWeight: '700', marginTop: 5, letterSpacing: 0.3 },

  armBtn: { backgroundColor: '#CCFF00', borderRadius: 20, paddingVertical: 22, alignItems: 'center' },
  armBtnMain: { color: '#000000', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  armBtnSub: { color: '#000000', fontSize: 10, fontWeight: '800', opacity: 0.45, marginTop: 4 },
});
