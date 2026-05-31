import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../IRONMIND/src/context/AuthContext'; 
import { useTrainingLoop } from './src/hooks/useTrainingLoop';
import { LoginScreen } from './src/screens/LoginScreen'; // 
import { HomeScreen } from './src/screens/HomeScreen';
import { ArmScreen } from './src/screens/ArmScreen';
import { WaitScreen } from './src/screens/WaitScreen';
import { RepScreen } from './src/screens/RepScreen';
import { RsltScreen } from './src/screens/RsltScreen';
import { FailScreen } from './src/screens/FailScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const NAV_TABS = [
  { state: 'HOME',    label: 'HOME',    icon: '⌂' },
  { state: 'STATS',   label: 'STATS',   icon: '▦' },
  { state: 'PROFILE', label: 'PROFILE', icon: '◉' },
] as const;


function RootNavigator() {
  const { fbUser, loading } = useAuth(); // 
  const { trainingState, setTrainingState, stats, history, lastElapsedTime, executeCloseRep, resetToIdle } = useTrainingLoop();

  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#CCFF00" />
      </View>
    );
  }

  
  if (!fbUser) {
    return <LoginScreen />;
  }

 
  const isNavVisible = NAV_TABS.some((t) => t.state === trainingState);

  const renderScreen = () => {
    switch (trainingState) {
      case 'HOME':
        return <HomeScreen stats={stats} history={history} onNavigate={setTrainingState} />;
      case 'ARM':
        return <ArmScreen onNavigate={setTrainingState} />;
      case 'WAIT':
        return <WaitScreen onNavigate={setTrainingState} />;
      case 'REP':
        return <RepScreen onNavigate={executeCloseRep} />;
      case 'RSLT':
        return <RsltScreen elapsedTime={lastElapsedTime} stats={stats} onNavigate={setTrainingState} />;
      case 'FAIL':
        return <FailScreen elapsedTime={lastElapsedTime} onReset={resetToIdle} />;
      case 'STATS':
        return <StatsScreen stats={stats} history={history} onNavigate={setTrainingState} />;
      case 'PROFILE':
        return <ProfileScreen stats={stats} onNavigate={setTrainingState} />;
      default:
        return <HomeScreen stats={stats} history={history} onNavigate={setTrainingState} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.mainContent}>{renderScreen()}</View>

      {isNavVisible && (
        <View style={styles.nav}>
          {NAV_TABS.map((tab) => {
            const active = trainingState === tab.state;
            return (
              <TouchableOpacity
                key={tab.state}
                style={styles.navItem}
                onPress={() => setTrainingState(tab.state)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <Text style={[styles.icon, active && styles.iconActive]}>{tab.icon}</Text>
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {tab.label}
                </Text>
                {active && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

// აპლიკაციის მთავარი ექსპორტი, რომელიც ყველაფერს AuthProvider-ში ფუთავს
export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  mainContent: { flex: 1 },
  // ლოუდერის სტილი შავი ფონით
  loadingContainer: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', alignItems: 'center' },

  nav: {
    flexDirection: 'row',
    backgroundColor: '#0D0D0D',
    borderTopWidth: 1,
    borderColor: '#161616',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  iconWrap: {
    width: 46,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#CCFF00',
  },
  icon: {
    fontSize: 17,
    color: '#2E2E2E',
  },
  iconActive: {
    color: '#000000',
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#2E2E2E',
  },
  navLabelActive: {
    color: '#CCFF00',
  },
  activeDot: {
    position: 'absolute',
    bottom: -14,
    width: 24,
    height: 2,
    backgroundColor: '#CCFF00',
    borderRadius: 1,
  },
});