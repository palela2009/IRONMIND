import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingProps {
  onComplete: () => void;
}

const APPS_LIST = ['Instagram', 'YouTube', 'TikTok', 'Facebook', 'X (Twitter)', 'Reddit', 'Snapchat'];

const GOALS = [
  { id: 'doomscroll', label: 'QUIT DOOMSCROLLING', sub: 'Stop mindless feed browsing' },
  { id: 'focus', label: 'BUILD FOCUS', sub: 'Train deep work habits' },
  { id: 'habit', label: 'BREAK THE HABIT', sub: 'Rewire compulsive checking' },
  { id: 'sleep', label: 'IMPROVE SLEEP', sub: 'No screens before bed' },
  { id: 'time', label: 'RECLAIM TIME', sub: 'Get hours back every week' },
];

const DIFFICULTIES = [
  { id: 'EASY', label: 'EASY', sub: 'Close within 5 seconds', badge: '5s' },
  { id: 'INTERMEDIATE', label: 'INTERMEDIATE', sub: 'Close within 3 seconds', badge: '3s' },
  { id: 'HARD', label: 'HARD', sub: 'Close within 2 seconds', badge: '2s' },
];

const ONBOARDING_URL = 'http://10.0.2.2:5000/api/user/onboarding';

export const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('EASY');
  const [saving, setSaving] = useState<boolean>(false);

  const toggleApp = (app: string) => {
    setSelectedApps((prev) =>
      prev.includes(app) ? prev.filter((a) => a !== app) : [...prev, app]
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    const data = {
      targetApps: selectedApps,
      goals: [selectedGoal],
      difficultyLevel: selectedDifficulty,
    };

    try {
      await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify(data));
      await fetch(ONBOARDING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}

    setSaving(false);
    onComplete();
  };

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <View style={styles.root}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <View style={styles.stepTag}>
        <Text style={styles.stepTagText}>{step} / 3</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === 1 && (
          <>
            <Text style={styles.title}>WHAT OWNS{'\n'}YOUR ATTENTION?</Text>
            <Text style={styles.sub}>Pick every app that pulls you in. You can change this later.</Text>
            {APPS_LIST.map((app) => {
              const on = selectedApps.includes(app);
              return (
                <TouchableOpacity
                  key={app}
                  style={[styles.appRow, on && styles.appRowOn]}
                  onPress={() => toggleApp(app)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.appLabel, on && styles.appLabelOn]}>{app}</Text>
                  <View style={[styles.appCheck, on && styles.appCheckOn]}>
                    {on && <Text style={styles.checkGlyph}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>WHAT ARE YOU{'\n'}TRAINING FOR?</Text>
            <Text style={styles.sub}>Your goal shapes the program. Pick one.</Text>
            {GOALS.map((g) => {
              const on = selectedGoal === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.goalRow, on && styles.goalRowOn]}
                  onPress={() => setSelectedGoal(g.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.goalLeft}>
                    <Text style={[styles.goalLabel, on && styles.goalLabelOn]}>{g.label}</Text>
                    <Text style={styles.goalSub}>{g.sub}</Text>
                  </View>
                  <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                    {on && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>SET YOUR{'\n'}RESISTANCE LEVEL.</Text>
            <Text style={styles.sub}>You can change this any time in your profile.</Text>
            {DIFFICULTIES.map((d) => {
              const on = selectedDifficulty === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.diffRow, on && styles.diffRowOn]}
                  onPress={() => setSelectedDifficulty(d.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.diffLeft}>
                    <View style={[styles.diffBadge, on && styles.diffBadgeOn]}>
                      <Text style={[styles.diffBadgeText, on && styles.diffBadgeTextOn]}>{d.badge}</Text>
                    </View>
                    <View>
                      <Text style={[styles.diffLabel, on && styles.diffLabelOn]}>{d.label}</Text>
                      <Text style={styles.diffSub}>{d.sub}</Text>
                    </View>
                  </View>
                  <View style={[styles.radioOuter, on && styles.radioOuterOn]}>
                    {on && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={styles.defaultNote}>
              <Text style={styles.defaultNoteText}>EASY is selected by default — no pressure.</Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 1 && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextBtn,
            step === 1 && selectedApps.length === 0 && styles.nextBtnDisabled,
            step === 2 && !selectedGoal && styles.nextBtnDisabled,
          ]}
          disabled={
            saving ||
            (step === 1 && selectedApps.length === 0) ||
            (step === 2 && !selectedGoal)
          }
          onPress={() => {
            if (step < 3) setStep((s) => (s + 1) as 1 | 2 | 3);
            else handleFinish();
          }}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step < 3 ? 'CONTINUE →' : 'ENTER IRONMIND →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },

  progressBar: { height: 2, backgroundColor: '#1A1A1A', marginBottom: 0 },
  progressFill: { height: '100%', backgroundColor: '#CCFF00' },

  stepTag: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 14,
    marginBottom: 4,
  },
  stepTagText: { color: '#444444', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },

  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  sub: { color: '#555555', fontSize: 13, lineHeight: 20, marginBottom: 28 },

  appRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1E1E21',
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 14,
    marginBottom: 10,
  },
  appRowOn: { borderColor: '#CCFF00', backgroundColor: '#0B1800' },
  appLabel: { color: '#888888', fontSize: 16, fontWeight: '700' },
  appLabelOn: { color: '#CCFF00' },
  appCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appCheckOn: { backgroundColor: '#CCFF00', borderColor: '#CCFF00' },
  checkGlyph: { color: '#000000', fontSize: 12, fontWeight: '900' },

  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1E1E21',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  goalRowOn: { borderColor: '#CCFF00', backgroundColor: '#0B1800' },
  goalLeft: { flex: 1, marginRight: 16 },
  goalLabel: { color: '#888888', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  goalLabelOn: { color: '#CCFF00' },
  goalSub: { color: '#444444', fontSize: 11, marginTop: 3 },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2E2E2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterOn: { borderColor: '#CCFF00' },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#CCFF00' },

  diffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1E1E21',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  diffRowOn: { borderColor: '#CCFF00', backgroundColor: '#0B1800' },
  diffLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  diffBadge: {
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    minWidth: 44,
    alignItems: 'center',
  },
  diffBadgeOn: { backgroundColor: '#CCFF00' },
  diffBadgeText: { color: '#666666', fontSize: 13, fontWeight: '900' },
  diffBadgeTextOn: { color: '#000000' },
  diffLabel: { color: '#888888', fontSize: 14, fontWeight: '800' },
  diffLabelOn: { color: '#CCFF00' },
  diffSub: { color: '#444444', fontSize: 11, marginTop: 2 },

  defaultNote: {
    backgroundColor: '#111111',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  defaultNoteText: { color: '#555555', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: '#141414',
    backgroundColor: '#0A0A0A',
  },
  backBtn: {
    width: 54,
    height: 56,
    backgroundColor: '#111111',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  backBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  nextBtn: {
    flex: 1,
    height: 56,
    backgroundColor: '#CCFF00',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtnDisabled: { backgroundColor: '#1A1A1A' },
  nextBtnText: { color: '#000000', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
});
