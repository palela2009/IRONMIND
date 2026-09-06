import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, PanResponder, Animated, Dimensions, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ProProvider, usePro } from './src/context/ProContext';
import { StreakReclaimModal } from './src/components/StreakReclaimModal';
import { StreakSavedOverlay } from './src/components/StreakSavedOverlay';
import { reportActiveDuels } from './src/hooks/useDuels';
import { ProScreen } from './src/screens/ProScreen';
import { WelcomeOfferScreen } from './src/screens/WelcomeOfferScreen';
import { useStats } from './src/hooks/useStats';
import { useNotifications } from './src/hooks/useNotifications';
import { useAppMonitor, syncAppMonitor } from './src/hooks/useAppMonitor';
import { radius, spacing, cardShadow, Palette } from './src/theme';
import { ThemeProvider, useThemedStyles, useTheme } from './src/context/ThemeContext';
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
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textFaint;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 14, height: 9, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: c }} />
      <View style={{ width: 10, height: 7, backgroundColor: c, borderRadius: 1 }} />
    </View>
  );
};

const AppsIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textFaint;
  return (
    <View style={{ width: 14, height: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 5, height: 5, backgroundColor: c, borderRadius: 1 }} />
      ))}
    </View>
  );
};

const SCREEN_ORDER: TrainingState[] = ['HOME', 'APPS', 'FRIENDS', 'PROFILE'];
const SCREEN_WIDTH = Dimensions.get('window').width;

const FriendsIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textFaint;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c, marginRight: -3, marginTop: 2 }} />
      <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: c }} />
    </View>
  );
};

const ProfileIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textFaint;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
      <View style={{ width: 14, height: 6, borderTopLeftRadius: 7, borderTopRightRadius: 7, backgroundColor: c }} />
    </View>
  );
};

function RootNavigator() {
  const styles = useThemedStyles(makeStyles);
  const nav = useThemedStyles(makeNav);
  const palette = useTheme();
  const { fbUser, loading } = useAuth();
  const { stats, history, recordChallenge, DAILY_CHALLENGE_LIMIT, refreshSettings, lostStreak, reclaimStreak, dismissLostStreak, savedStreak, dismissSavedStreak } = useStats();
  const [showPro, setShowPro] = useState<boolean>(false);
  const { refresh: refreshEntitlement } = usePro();
  useNotifications(fbUser?.uid);

  useEffect(() => {
    if (!fbUser?.uid) return;
    authedFetch(`${API_BASE_URL}/api/user/onboarding`, {
      method: 'POST',
      body: JSON.stringify({
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      }),
    }).catch(() => {});
  }, [fbUser?.uid]);

  useEffect(() => {
    if (!fbUser?.uid) return;
    reportActiveDuels();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reportActiveDuels();
    });
    return () => sub.remove();
  }, [fbUser?.uid]);

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

  // Screens stay mounted once visited and are hidden rather than unmounted. Swapping a single
  // component meant every swipe tore the old screen down and rebuilt the new one, re-running
  // its hooks, refetching everything and losing scroll position. Mounting lazily on first
  // visit keeps startup cheap while making every later swipe instant.
  const [visited, setVisited] = useState<TrainingState[]>(['HOME']);
  useEffect(() => {
    setVisited((prev) => (prev.includes(screen) ? prev : [...prev, screen]));
  }, [screen]);

  const dragX = useRef(new Animated.Value(0)).current;

  const slideTo = (nextIndex: number, direction: number) => {
    Animated.timing(dragX, {
      toValue: -direction * SCREEN_WIDTH,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      setScreen(SCREEN_ORDER[nextIndex]);
      dragX.setValue(direction * SCREEN_WIDTH);
      Animated.timing(dragX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  };

  const slideToRef = useRef(slideTo);
  slideToRef.current = slideTo;

  const goToTab = (id: TrainingState) => {
    const from = SCREEN_ORDER.indexOf(screenRef.current);
    const to = SCREEN_ORDER.indexOf(id);
    if (to === from) return;
    slideTo(to, to > from ? 1 : -1);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_, gesture) => {
        const index = SCREEN_ORDER.indexOf(screenRef.current);
        const atStart = index === 0 && gesture.dx > 0;
        const atEnd = index === SCREEN_ORDER.length - 1 && gesture.dx < 0;
        dragX.setValue(atStart || atEnd ? gesture.dx * 0.25 : gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const index = SCREEN_ORDER.indexOf(screenRef.current);
        if (gesture.dx < -50 && index < SCREEN_ORDER.length - 1) {
          slideToRef.current(index + 1, 1);
        } else if (gesture.dx > 50 && index > 0) {
          slideToRef.current(index - 1, -1);
        } else {
          Animated.spring(dragX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
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
    // Entitlement was last fetched before onboarding created the account document, so the
    // welcome offer would still read as unavailable without re-reading it here.
    await refreshEntitlement();
    setIsOnboarded(true);
  };

  if (loading || checkingOnboarding) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  if (!fbUser) return <LoginScreen />;
  if (!isOnboarded) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  const screenFor = (id: TrainingState) => {
    switch (id) {
      case 'APPS':
        return <AppsScreen history={history} onSettingsChanged={refreshSettings} onNavigate={goToTab} />;
      case 'FRIENDS':
        return <FriendsScreen stats={stats} onNavigate={goToTab} />;
      case 'PROFILE':
        return <ProfileScreen stats={stats} history={history} onSettingsChanged={refreshSettings} onNavigate={goToTab} />;
      default:
        return <HomeScreen stats={stats} history={history} dailyChallengeLimit={DAILY_CHALLENGE_LIMIT} onNavigate={goToTab} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Animated.View
        style={[styles.mainContent, { transform: [{ translateX: dragX }] }]}
        {...panResponder.panHandlers}
      >
        {visited.map((id) => (
          <View
            key={id}
            style={[StyleSheet.absoluteFill, id !== screen && styles.screenHidden]}
            pointerEvents={id === screen ? 'auto' : 'none'}
          >
            {screenFor(id)}
          </View>
        ))}
      </Animated.View>

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
                onPress={() => goToTab(tab.id)}
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

      <StreakReclaimModal
        lostStreak={lostStreak}
        onReclaim={reclaimStreak}
        onDismiss={dismissLostStreak}
        onOpenPro={() => {
          dismissLostStreak();
          setShowPro(true);
        }}
      />

      <WelcomeOfferScreen />

      <StreakSavedOverlay
        streak={savedStreak?.streak ?? 0}
        source={savedStreak?.source ?? null}
        onDone={dismissSavedStreak}
      />

      <ProScreen visible={showPro} onClose={() => setShowPro(false)} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProProvider>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </ProProvider>
    </AuthProvider>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  mainContent: { flex: 1 },
  screenHidden: { display: 'none' },
  loadingContainer: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
});

const makeNav = (c: Palette) => StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  bar: {
    flexDirection: 'row',
    backgroundColor: c.surface,
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
  iconWrapActive: { backgroundColor: c.accent },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: c.textFaint },
  labelActive: { color: c.accent },
});
