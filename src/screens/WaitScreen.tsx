import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface WaitProps {
  onNavigate: (state: any) => void;
}

export const WaitScreen: React.FC<WaitProps> = ({ onNavigate }) => {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => onNavigate('HOME')}>
          <Text style={styles.endText}>← END SESSION</Text>
        </TouchableOpacity>
        <View style={styles.armedBadge}>
          <View style={styles.armedDot} />
          <Text style={styles.armedText}>ARMED</Text>
        </View>
      </View>

      <View style={styles.center}>
        <View style={styles.ringOuter}>
          <View style={styles.ringMid}>
            <View style={styles.ringInner}>
              <Text style={styles.pulseSymbol}>◉</Text>
              <Text style={styles.listeningText}>LISTENING</Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>Don't watch{'\n'}the screen.</Text>
        <Text style={styles.desc}>
          Pocket the phone. A trigger will fire at a random moment — you won't know when.
        </Text>
      </View>
      <View />
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
  endText: { color: '#555555', fontSize: 12, fontWeight: '800' },
  armedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0B1800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A4400',
  },
  armedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CCFF00' },
  armedText: { color: '#CCFF00', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 16 },
  ringOuter: {
    width: 288,
    height: 288,
    borderRadius: 144,
    borderWidth: 1,
    borderColor: '#161618',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 44,
  },
  ringMid: {
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 1,
    borderColor: '#1E1E21',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    width: 216,
    height: 216,
    borderRadius: 108,
    borderWidth: 3,
    borderColor: '#CCFF00',
    backgroundColor: '#0A1300',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  pulseSymbol: { color: '#CCFF00', fontSize: 48, lineHeight: 54 },
  listeningText: { color: '#4A6600', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', textAlign: 'center', lineHeight: 36, marginBottom: 12 },
  desc: { color: '#444444', fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
});