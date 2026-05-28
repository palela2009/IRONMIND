import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface FailProps {
  elapsedTime: number;
  onReset: () => void;
}

export const FailScreen: React.FC<FailProps> = ({ elapsedTime, onReset }) => {
  const t = elapsedTime > 0 ? elapsedTime.toFixed(1) : '0.8';

  return (
    <View style={styles.container}>
      <View style={styles.redStripe} />

      <View style={styles.tag}>
        <Text style={styles.tagText}>★ SET BROKEN · STREAK RESET</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>YOU{'\n'}SCROLLED.</Text>
        <Text style={styles.desc}>
          <Text style={styles.descAccent}>{t}s</Text>
          {' '}elapsed before you closed it. Past 5s the hook owns you. Streak resets to{' '}
          <Text style={styles.descBold}>0</Text>.
        </Text>

        <View style={styles.cueCard}>
          <Text style={styles.cueLabel}>★ COACH NOTE</Text>
          <Text style={styles.cueText}>
            The reflex lives in the <Text style={styles.cueItalic}>gap</Text> between trigger and reaction. When you feel the pull next time — count one breath, then close.
          </Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={onReset} activeOpacity={0.85}>
          <Text style={styles.resetBtnText}>RESET & TRAIN AGAIN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.arrowBtn} onPress={onReset} activeOpacity={0.85}>
          <Text style={styles.arrowBtnText}>↗</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', paddingBottom: 30 },

  redStripe: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 90,
    bottom: 0,
    backgroundColor: '#FF1133',
    opacity: 0.18,
  },

  tag: { paddingHorizontal: 20, paddingTop: 52, marginBottom: 0 },
  tagText: { color: '#FF1133', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  body: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 32 },
  title: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -3,
    lineHeight: 74,
    marginBottom: 16,
  },
  desc: { color: '#666666', fontSize: 14, lineHeight: 22, marginBottom: 28 },
  descAccent: { color: '#FF1133', fontWeight: '800' },
  descBold: { color: '#FFFFFF', fontWeight: '800' },

  cueCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  cueLabel: { color: '#FF1133', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 10 },
  cueText: { color: '#AAAAAA', fontSize: 13, lineHeight: 20 },
  cueItalic: { fontStyle: 'italic', color: '#FFFFFF' },

  btnRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10 },
  resetBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetBtnText: { color: '#000000', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  arrowBtn: {
    width: 56,
    backgroundColor: '#CCFF00',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnText: { color: '#000000', fontSize: 22, fontWeight: '900' },
});
