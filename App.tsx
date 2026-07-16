import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useStats } from './src/hooks/useStats';
import { useNotifications } from './src/hooks/useNotifications';
import { useAppMonitor, syncAppMonitor } from './src/hooks/useAppMonitor';
import { colors, radius, spacing, cardShadow } from './src/theme';
import { authedFetch } from './src/utils/authFetch';
import { API_BASE_URL } from './src/config/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
import { TrainingState } from './src/types/training';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AppsScreen } from './src/screens/AppsScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const HomeIcon = ({ active }: { active: boolean }) => {
  const c = active ? '#000000' : colors.textFaint;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 14, height: 9, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: c }} />
      <View style={{ width: 10, height: 7, backgroundColor: c, borderRadius: 1 }} />
    </View>
  );
};

const AppsIcon = ({ active }: { active: boolean }) => {
  const c = active ? '#000000' : colors.textFaint;
  return (
    <View style={{ width: 14, height: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 5, height: 5, backgroundColor: c, borderRadius: 1 }} />
      ))}
    </View>
  );
};

const SCREEN_ORDER: TrainingState[] = ['HOME', 'APPS', 'FRIENDS', 'PROFILE'];

const FriendsIcon = ({ active }: { active: boolean }) => {
  const c = active ? '#000000' : colors.textFaint;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c, marginRight: -3, marginTop: 2 }} />
      <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: c }} />
    </View>
  );
};

const ProfileIcon = ({ active }: { active: boolean }) => {
  const c = active ? '#000000' : colors.textFaint;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      <View style={{ width: 14, height: 6, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: c }} />
    </View>
  );
};

function RootNavigator() {
  const { fbUser, loading } = useAuth();
  const { stats, history, recordChallenge, DAILY_CHALLENGE_LIMIT, refreshSettings } = useStats();
  useNotifications(fbUser?.uid);

  const recordChallengeRef = useRef(recordChallenge);
  recordChallengeRef.current = recordChallenge;

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      'IronmindChallengeResult',
      (result: { targetApp: string; elapsedTime: number; wasSuccessful: boolean }) => {
        recordChallengeRef.current(result.elapsedTime, result.targetApp, result.wasSuccessful);
      }
    );
    return () => sub.remove();
  }, []);
  const [screen, setScreen] = useState<TrainingState>('HOME');
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState<boolean>(true);

  useAppMonitor(fbUser?.uid);

  const screenRef = useRef(screen);
  screenRef.current = screen;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderRelease: (_, gesture) => {
        const index = SCREEN_ORDER.indexOf(screenRef.current);
        if (gesture.dx < -50 && index < SCREEN_ORDER.length - 1) {
          setScreen(SCREEN_ORDER[index + 1]);
        } else if (gesture.dx > 50 && index > 0) {
          setScreen(SCREEN_ORDER[index - 1]);
        }
      },
    })
  ).current;

  useEffect(() => {
    let cancelled = false;
    const finish = (onboarded: boolean) => {
      if (cancelled) return;
      setIsOnboarded(onboarded);
      setCheckingOnboarding(false);
    };

    const check = async () => {
      setCheckingOnboarding(true);
      try {
        const val = await AsyncStorage.getItem('@ironmind_onboarded');
        if (val === 'true') return finish(true);

        // No local flag — before sending this account through onboarding again, check
        // whether the cloud already has real settings for it. A local reset (e.g. the
        // account-switch guard clearing stale data from a previous account on this
        // device) shouldn't force a *returning* account to redo onboarding from scratch.
        if (fbUser?.uid) {
          const res = await authedFetch(`${API_BASE_URL}/api/user/onboarding`);
          if (res.ok) {
            const cloud = await res.json();
            if (cloud.onboarded) {
              await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify({
                targetApps: cloud.targetApps,
                goals: cloud.goals,
                difficultyLevel: cloud.difficultyLevel,
                dailyChallengeLimit: cloud.dailyChallengeLimit,
              }));
              await AsyncStorage.setItem('@ironmind_onboarded', 'true');
              await syncAppMonitor();
              return finish(true);
            }
          }
        }
        finish(false);
      } catch {
        finish(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, [fbUser?.uid]);

  const handleOnboardingComplete = async () => {
    await AsyncStorage.setItem('@ironmind_onboarded', 'true');
    setIsOnboarded(true);
  };

  if (loading || checkingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#CCFF00" />
      </View>
    );
  }

  if (!fbUser) return <LoginScreen />;
  if (!isOnboarded) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  const renderScreen = () => {
    switch (screen) {
      case 'HOME':
        return <HomeScreen stats={stats} history={history} dailyChallengeLimit={DAILY_CHALLENGE_LIMIT} onNavigate={setScreen} />;
      case 'APPS':
        return <AppsScreen history={history} onNavigate={setScreen} />;
      case 'FRIENDS':
        return <FriendsScreen onNavigate={setScreen} />;
      case 'PROFILE':
        return <ProfileScreen stats={stats} onSettingsChanged={refreshSettings} onNavigate={setScreen} />;
      default:
        return <HomeScreen stats={stats} history={history} dailyChallengeLimit={DAILY_CHALLENGE_LIMIT} onNavigate={setScreen} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.mainContent} {...panResponder.panHandlers}>{renderScreen()}</View>

      <View style={nav.container}>
        <View style={nav.bar}>
          {([
            { id: 'HOME' as TrainingState, label: 'HOME', Icon: HomeIcon },
            { id: 'APPS' as TrainingState, label: 'APPS', Icon: AppsIcon },
            { id: 'FRIENDS' as TrainingState, label: 'FRIENDS', Icon: FriendsIcon },
            { id: 'PROFILE' as TrainingState, label: 'YOU', Icon: ProfileIcon },
          ] as { id: TrainingState; label: string; Icon: React.FC<{ active: boolean }> }[]).map((tab) => {
            const active = screen === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={nav.item}
                onPress={() => setScreen(tab.id)}
                activeOpacity={0.7}
              >
                <View style={[nav.iconWrap, active && nav.iconWrapActive]}>
                  <tab.Icon active={active} />
                </View>
                <Text style={[nav.label, active && nav.labelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  mainContent: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
});

const nav = StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    ...cardShadow,
  },
  item: { flex: 1, alignItems: 'center', gap: 5 },
  iconWrap: {
    width: 48,
    height: 30,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: { backgroundColor: colors.accent },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: colors.textFaint },
  labelActive: { color: colors.accent },
});
