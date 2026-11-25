import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, PanResponder, Animated, useWindowDimensions, AppState, Easing } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ProProvider, usePro } from './src/context/ProContext';
import { initCrashReporting, setCrashUser, wrapWithCrashReporting } from './src/config/sentry';
import { StreakReclaimModal } from './src/components/StreakReclaimModal';
import { StreakFreezeModal } from './src/components/StreakFreezeModal';
import { StreakSavedOverlay } from './src/components/StreakSavedOverlay';
import { MilestoneOverlay } from './src/components/MilestoneOverlay';
import { ShortVideoSetupModal } from './src/components/ShortVideoSetupModal';
import { reportActiveDuels } from './src/hooks/useDuels';
import { ProScreen } from './src/screens/ProScreen';
import { WelcomeOfferScreen } from './src/screens/WelcomeOfferScreen';
import { ProIntroScreen } from './src/screens/ProIntroScreen';
import { InviteRewardOverlay } from './src/components/InviteRewardOverlay';
import { AppDialogHost } from './src/components/AppDialog';
import { PermissionGate } from './src/components/PermissionGate';
import { WelcomeGiftScreen } from './src/screens/WelcomeGiftScreen';
import { useStats } from './src/hooks/useStats';
import { useInstagramReelsTest } from './src/hooks/useInstagramReelsTest';
import { useNotifications } from './src/hooks/useNotifications';
import { useAppMonitor, syncAppMonitor } from './src/hooks/useAppMonitor';
import { useScreenTimeSync } from './src/hooks/useScreenTime';
import { notifyTabChange } from './src/hooks/useTabScrollReset';
import { radius, spacing, cardShadow, Palette } from './src/theme';
import { ThemeProvider, useThemedStyles, useTheme } from './src/context/ThemeContext';
import { authedFetch } from './src/utils/authFetch';
import { deviceTimeZone } from './src/utils/challengeTime';
import { auth } from './src/config/firebase';
import { API_BASE_URL } from './src/config/api';
import { TrainingState } from './src/types/training';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AppsScreen } from './src/screens/AppsScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

initCrashReporting();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const HomeIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textTertiary;
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 15, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: c }} />
      <View style={{ width: 11, height: 7, backgroundColor: c, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
};

const AppsIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textTertiary;
  return (
    <View style={{ width: 14, height: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 2.5 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 5.5, height: 5.5, backgroundColor: c, borderRadius: 2 }} />
      ))}
    </View>
  );
};

const SCREEN_ORDER: TrainingState[] = ['HOME', 'APPS', 'FRIENDS', 'PROFILE'];

const FriendsIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textTertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ alignItems: 'center', marginRight: -2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c, marginBottom: 1 }} />
        <View style={{ width: 10, height: 5, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: c }} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c, marginBottom: 1 }} />
        <View style={{ width: 12, height: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: c }} />
      </View>
    </View>
  );
};

const ProfileIcon = ({ active }: { active: boolean }) => {
  const palette = useTheme();
  const c = active ? palette.accentContrast : palette.textTertiary;
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
  const {
    stats, history, monitoredApps, reportedHours, challengeTimeZone,
    syncStatus, syncMessage, pendingCount, retrySync,
    DAILY_CHALLENGE_LIMIT, refreshSettings, lostStreak, reclaimStreak,
    dismissLostStreak, savedStreak, dismissSavedStreak,
  } = useStats();
  const [showPro, setShowPro] = useState<boolean>(false);
  const [showFreeze, setShowFreeze] = useState<boolean>(false);
  const { refresh: refreshEntitlement, welcomeOffer, welcomeGiftAvailable } = usePro();
  const [notificationTarget, setNotificationTarget] = useState<TrainingState | null>(null);
  useNotifications(fbUser?.uid, setNotificationTarget);

  useEffect(() => {
    if (!fbUser?.uid) return;
    authedFetch(`${API_BASE_URL}/api/user/onboarding`, {
      method: 'POST',
      body: JSON.stringify({
        timeZone: deviceTimeZone(),
        email: fbUser.email,
        displayName: fbUser.displayName,
        photoURL: fbUser.photoURL,
      }),
    }, fbUser.uid).then(async (res) => {
      if (!res.ok) return;
      const profile = await res.json();
      if (auth.currentUser?.uid !== fbUser.uid) return;
      const raw = await AsyncStorage.getItem('@ironmind_onboarding');
      if (raw && profile.challengeTimeZone) {
        await AsyncStorage.setItem('@ironmind_onboarding', JSON.stringify({ ...JSON.parse(raw), timeZone: profile.challengeTimeZone }));
        await syncAppMonitor();
        await refreshSettings();
      }
    }).catch(() => {});
  }, [fbUser?.uid]);

  useEffect(() => {
    setCrashUser(fbUser?.uid ?? null);
  }, [fbUser?.uid]);

  useEffect(() => {
    if (!fbUser?.uid) return;
    reportActiveDuels();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        reportActiveDuels();
        refreshEntitlement();
      }
    });
    return () => sub.remove();
  }, [fbUser?.uid]);

  const [screen, setScreen] = useState<TrainingState>('HOME');
  const [isOnboarded, setIsOnboarded] = useState<boolean>(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState<boolean>(true);
  const reelsTest = useInstagramReelsTest(fbUser?.uid, false);

  useAppMonitor(fbUser?.uid);
  useScreenTimeSync(fbUser?.uid);

  const screenRef = useRef(screen);
  screenRef.current = screen;

  const { width: windowWidth } = useWindowDimensions();
  const [viewportWidth, setViewportWidth] = useState(0);
  const pageWidth = Math.max(1, viewportWidth || windowWidth);
  const pageWidthRef = useRef(pageWidth);
  pageWidthRef.current = pageWidth;

  const position = useRef(new Animated.Value(0)).current;
  const pageOffsets = useMemo(
    () => SCREEN_ORDER.map((_, i) => Animated.multiply(Animated.add(position, i), pageWidth)),
    [position, pageWidth]
  );

  const resetToHome = () => {
    position.stopAnimation();
    position.setValue(0);
    screenRef.current = 'HOME';
    setScreen('HOME');
  };

  useEffect(() => {
    resetToHome();
    setShowPro(false);
    setShowFreeze(false);
    setNotificationTarget(null);
  }, [fbUser?.uid]);

  const slideTo = (nextIndex: number) => {
    if (SCREEN_ORDER[nextIndex] !== screenRef.current) notifyTabChange(SCREEN_ORDER[nextIndex]);
    setScreen(SCREEN_ORDER[nextIndex]);
    Animated.timing(position, {
      toValue: -nextIndex,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const slideToRef = useRef(slideTo);
  slideToRef.current = slideTo;

  const goToTab = (id: TrainingState) => {
    const to = SCREEN_ORDER.indexOf(id);
    if (to === SCREEN_ORDER.indexOf(screenRef.current)) return;
    slideTo(to);
  };

  useEffect(() => {
    if (fbUser && isOnboarded && notificationTarget) {
      goToTab(notificationTarget);
      setNotificationTarget(null);
    }
  }, [fbUser?.uid, isOnboarded, notificationTarget]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 20 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
      onPanResponderMove: (_, gesture) => {
        const index = SCREEN_ORDER.indexOf(screenRef.current);
        const atStart = index === 0 && gesture.dx > 0;
        const atEnd = index === SCREEN_ORDER.length - 1 && gesture.dx < 0;
        const drag = gesture.dx / pageWidthRef.current;
        position.setValue(-index + (atStart || atEnd ? drag * 0.25 : drag));
      },
      onPanResponderRelease: (_, gesture) => {
        const index = SCREEN_ORDER.indexOf(screenRef.current);
        const flung = Math.abs(gesture.vx) > 0.5;
        const far = Math.abs(gesture.dx) > pageWidthRef.current / 3;
        if ((flung || far) && gesture.dx < 0 && index < SCREEN_ORDER.length - 1) {
          slideToRef.current(index + 1);
        } else if ((flung || far) && gesture.dx > 0 && index > 0) {
          slideToRef.current(index - 1);
        } else {
          slideToRef.current(index);
        }
      },
      onPanResponderTerminate: () => {
        slideToRef.current(SCREEN_ORDER.indexOf(screenRef.current));
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
                appLimits: cloud.appLimits ?? [],
                timeZone: cloud.timeZone ?? deviceTimeZone(),
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
    await refreshEntitlement();
    await refreshSettings();
    resetToHome();
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
  if (!isOnboarded) {
    return (
      <>
        <OnboardingScreen onComplete={handleOnboardingComplete} reelsTest={reelsTest} />
        <ShortVideoSetupModal controller={reelsTest} />
      </>
    );
  }

  const suppressMilestone =
    welcomeGiftAvailable || welcomeOffer || lostStreak > 0 || savedStreak !== null || Boolean(reelsTest?.guideVisible);

  const screenFor = (id: TrainingState) => {
    switch (id) {
      case 'APPS':
        return (
          <AppsScreen
            history={history}
            onSettingsChanged={refreshSettings}
            onNavigate={goToTab}
            reelsTest={reelsTest}
          />
        );
      case 'FRIENDS':
        return (
          <FriendsScreen
            stats={stats}
            isActive={screen === 'FRIENDS'}
            onNavigate={goToTab}
            onOpenPro={() => setShowPro(true)}
          />
        );
      case 'PROFILE':
        return (
          <ProfileScreen
            stats={stats}
            history={history}
            challengeTimeZone={challengeTimeZone}
            onSettingsChanged={refreshSettings}
            syncStatus={syncStatus}
            syncMessage={syncMessage}
            pendingCount={pendingCount}
            onRetrySync={retrySync}
            onNavigate={goToTab}
            onOpenFreeze={() => setShowFreeze(true)}
            reelsTest={reelsTest}
          />
        );
      default:
        return (
          <HomeScreen
            stats={stats}
            history={history}
            dailyChallengeLimit={DAILY_CHALLENGE_LIMIT}
            challengeTimeZone={challengeTimeZone}
            reportedHours={reportedHours}
            reelsTest={reelsTest}
            onNavigate={goToTab}
            onOpenPro={() => setShowPro(true)}
            onOpenFreeze={() => setShowFreeze(true)}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View
        style={styles.mainContent}
        onLayout={({ nativeEvent }) => setViewportWidth(nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {SCREEN_ORDER.map((id, i) => (
          <Animated.View
            key={id}
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: pageOffsets[i] }] }]}
            pointerEvents={id === screen ? 'auto' : 'none'}
          >
            {screenFor(id)}
          </Animated.View>
        ))}
      </View>

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
                <View style={nav.iconWrap}>
                  <View style={[nav.pill, { opacity: active ? 1 : 0 }]} />
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
      <ProIntroScreen />
      <InviteRewardOverlay />
      <WelcomeGiftScreen />
      <PermissionGate />
      <ShortVideoSetupModal controller={reelsTest} />

      <MilestoneOverlay
        uid={fbUser.uid}
        stats={stats}
        history={history}
        dailyLimit={DAILY_CHALLENGE_LIMIT}
        timeZone={challengeTimeZone}
        suppressed={suppressMilestone}
      />

      <StreakSavedOverlay
        streak={savedStreak?.streak ?? 0}
        source={savedStreak?.source ?? null}
        onDone={dismissSavedStreak}
      />

      <StreakFreezeModal
        visible={showFreeze}
        streak={stats.currentStreak}
        onClose={() => setShowFreeze(false)}
        onOpenPro={() => setShowPro(true)}
      />

      <ProScreen
        visible={showPro}
        onClose={() => setShowPro(false)}
        currentStreak={stats.currentStreak}
        onOpenFriends={() => {
          setShowPro(false);
          goToTab('FRIENDS');
        }}
        onOpenHome={() => {
          setShowPro(false);
          goToTab('HOME');
        }}
      />
    </SafeAreaView>
  );
}

function App() {
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProProvider>
          <ThemeProvider>
            <RootNavigator />
            <AppDialogHost />
          </ThemeProvider>
        </ProProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default wrapWithCrashReporting(App);

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  mainContent: { flex: 1, overflow: 'hidden' },
  loadingContainer: { flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' },
});

const makeNav = (c: Palette) => StyleSheet.create({
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, paddingTop: 4 },
  bar: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    ...cardShadow,
  },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 54,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.accent, borderRadius: 15 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, color: c.textTertiary },
  labelActive: { color: c.accent, fontWeight: '900' },
});
