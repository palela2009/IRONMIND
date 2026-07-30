import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform, AppState, ActivityIndicator, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ChallengeItem } from '../types/training';
import { useAuth } from '../context/AuthContext';
import { useScreenTime, formatMinutes } from '../hooks/useScreenTime';

interface AppsProps {
  history: ChallengeItem[];
  onNavigate: (state: any) => void;
}

const APP_COLORS: Record<string, string> = {
  Instagram: '#833AB4',
  YouTube: '#FF0000',
  TikTok: '#010101',
  Facebook: '#1877F2',
  'X (Twitter)': '#14171A',
  Reddit: '#FF4500',
  Snapchat: '#FFFC00',
};
import { API_BASE_URL } from '../config/api';
import { authedFetch } from '../utils/authFetch';

const BACKEND_URL = `${API_BASE_URL}/api/challenge/notify`;

const APP_ICONS: Record<string, string> = {
  Instagram: 'IG',
  YouTube: 'YT',
  TikTok: 'TK',
  Facebook: 'FB',
  'X (Twitter)': 'X',
  Reddit: 'RD',
  Snapchat: 'SC',
};

const FALLBACK_PALETTE = ['#4C6EF5', '#12B886', '#F59F00', '#E64980', '#7048E8', '#15AABF', '#FA5252'];

const colorForApp = (app: string): string => {
  if (APP_COLORS[app]) return APP_COLORS[app];
  let hash = 0;
  for (let i = 0; i < app.length; i++) hash = (hash * 31 + app.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
};

const abbrForApp = (app: string): string => {
  if (APP_ICONS[app]) return APP_ICONS[app];
  const words = app.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return app.slice(0, 2).toUpperCase();
};

export const AppsScreen: React.FC<AppsProps> = ({ history }) => {
  const { fbUser } = useAuth();
  const { screenTime, loading: stLoading } = useScreenTime(fbUser?.uid);
  const [monitoredApps, setMonitoredApps] = useState<string[]>([]);
  const [notifGranted, setNotifGranted] = useState<boolean>(false);
  const [usageAccessGranted, setUsageAccessGranted] = useState<boolean>(false);
  const [batteryExempt, setBatteryExempt] = useState<boolean>(false);
  const [realPushState, setRealPushState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const checkPermissions = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setNotifGranted(status === 'granted');

    if (Platform.OS === 'android' && NativeModules.UsageMonitor) {
      try {
        const granted = await NativeModules.UsageMonitor.hasUsageAccess();
        setUsageAccessGranted(!!granted);
      } catch {
        setUsageAccessGranted(false);
      }
      try {
        const exempt = await NativeModules.UsageMonitor.isIgnoringBatteryOptimizations();
        setBatteryExempt(!!exempt);
      } catch {
        setBatteryExempt(false);
      }
    }

    const raw = await AsyncStorage.getItem('@ironmind_onboarding').catch(() => null);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.targetApps?.length > 0) setMonitoredApps(data.targetApps);
    }
  }, []);

  useEffect(() => {
    checkPermissions();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermissions();
    });
    return () => sub.remove();
  }, [checkPermissions]);

  const handleRequestNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifGranted(status === 'granted');
  };

  const handleOpenUsageAccess = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.sendIntent('android.settings.USAGE_ACCESS_SETTINGS');
      } else {
        await Linking.openSettings();
      }
    } catch {
      await Linking.openSettings();
    }
  };

  const handleRequestBatteryExemption = () => {
    if (Platform.OS === 'android' && NativeModules.UsageMonitor) {
      NativeModules.UsageMonitor.requestIgnoreBatteryOptimizations();
    }
  };

  const handleRealPushTest = async () => {
    if (!fbUser?.uid) return;
    setRealPushState('sending');
    try {
      const res = await authedFetch(BACKEND_URL, {
        method: 'POST',
        body: JSON.stringify({ test: true }),
      });
      setRealPushState(res.ok ? 'sent' : 'error');
    } catch {
      setRealPushState('error');
    }
    setTimeout(() => setRealPushState('idle'), 4000);
  };

  const getChallengesForApp = (app: string) => {
    const items = history.filter((i) => i.targetApp === app);
    const successes = items.filter((i) => i.wasSuccessful).length;
    const bestTime = items
      .filter((i) => i.wasSuccessful && i.elapsedTime > 0)
      .reduce((best, i) => (best === 0 || i.elapsedTime < best ? i.elapsedTime : best), 0);
    return { total: items.length, successes, bestTime };
  };

  const getTodayChallenges = (app: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return history.filter((i) => i.targetApp === app && i.timestamp >= today.getTime()).length;
  };

  const totalMinutes = screenTime.reduce((sum, item) => sum + item.minutes, 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>APPS</Text>
      </View>

      {/* SCREEN TIME SECTION */}
      <View style={styles.stCard}>
        <View style={styles.stHeaderRow}>
          <Text style={styles.stCardTitle}>TODAY'S SCREEN TIME</Text>
          {!stLoading && screenTime.length > 0 && (
            <Text style={styles.stTotal}>{formatMinutes(totalMinutes)}</Text>
          )}
        </View>
        {stLoading ? (
          <ActivityIndicator color="#CCFF00" style={{ marginVertical: 20 }} />
        ) : screenTime.length === 0 ? (
          <Text style={styles.stEmpty}>No data yet — grant Usage Access below to enable tracking.</Text>
        ) : (
          screenTime.slice(0, 10).map((item, i) => {
            const maxMins = screenTime[0].minutes || 1;
            const pct = Math.max((item.minutes / maxMins) * 100, 3);
            return (
              <View key={item.app} style={styles.stRow}>
                <View style={[styles.stIcon, { backgroundColor: colorForApp(item.app) }]}>
                  <Text style={styles.stIconText}>{abbrForApp(item.app)}</Text>
                </View>
                <Text style={styles.stApp} numberOfLines={1}>{item.app}</Text>
                <View style={styles.stBarWrap}>
                  <View style={[styles.stBar, { width: `${pct}%` as any }]} />
                </View>
                <Text style={styles.stTime}>{formatMinutes(item.minutes)}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* STATUS SECTION */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, notifGranted && styles.statusDotOn]} />
            <Text style={styles.statusLabel}>Notifications</Text>
          </View>
          {notifGranted ? (
            <Text style={styles.statusOn}>ALLOWED</Text>
          ) : (
            <TouchableOpacity onPress={handleRequestNotifications} activeOpacity={0.8}>
              <Text style={styles.statusFix}>ENABLE →</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, usageAccessGranted && styles.statusDotOn]} />
            <Text style={styles.statusLabel}>Usage Access</Text>
          </View>
          {usageAccessGranted ? (
            <Text style={styles.statusOn}>ON</Text>
          ) : (
            <TouchableOpacity onPress={handleOpenUsageAccess} activeOpacity={0.8}>
              <Text style={styles.statusFix}>TURN ON →</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.statusDivider} />
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, batteryExempt && styles.statusDotOn]} />
            <Text style={styles.statusLabel}>Battery Optimization</Text>
          </View>
          {batteryExempt ? (
            <Text style={styles.statusOn}>OFF</Text>
          ) : (
            <TouchableOpacity onPress={handleRequestBatteryExemption} activeOpacity={0.8}>
              <Text style={styles.statusFix}>TURN OFF →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {!batteryExempt && (
        <Text style={styles.batteryHint}>
          Some phones (especially Xiaomi/MIUI) can kill or delay the background monitor to
          save battery, which breaks challenge detection. Turning this off keeps it reliable.
        </Text>
      )}

      {/* TEST SECTION */}
      <View style={styles.testCard}>
        <Text style={styles.testCardTitle}>TEST CHALLENGE NOTIFICATION</Text>
        <Text style={styles.testCardBody}>
          Sends a real push through the backend and Expo — the same path a live challenge uses.
        </Text>
        <TouchableOpacity
          style={[styles.testBtn, realPushState === 'sent' && styles.testBtnSent]}
          onPress={handleRealPushTest}
          activeOpacity={0.85}
          disabled={realPushState === 'sending' || !fbUser?.uid}
        >
          <Text style={styles.testBtnText}>
            {realPushState === 'sending' && 'SENDING…'}
            {realPushState === 'sent' && 'SENT — CHECK YOUR PHONE ✓'}
            {realPushState === 'error' && 'FAILED — CHECK BACKEND ✗'}
            {realPushState === 'idle' && 'SEND TEST PUSH →'}
          </Text>
        </TouchableOpacity>
      </View>

      {monitoredApps.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>YOUR APPS · {monitoredApps.length} TRACKED</Text>
          {monitoredApps.map((app) => {
            const { total, successes, bestTime } = getChallengesForApp(app);
            const todayCount = getTodayChallenges(app);
            const rate = total > 0 ? Math.round((successes / total) * 100) : null;
            const color = colorForApp(app);
            const abbr = abbrForApp(app);

            return (
              <View key={app} style={styles.appCard}>
                <View style={styles.appTopRow}>
                  <View style={[styles.appIcon, { backgroundColor: color }]}>
                    <Text style={styles.appIconText}>{abbr}</Text>
                  </View>
                  <View style={styles.appBody}>
                    <Text style={styles.appName}>{app}</Text>
                    <Text style={styles.appSub}>
                      {todayCount > 0 ? `${todayCount} challenge${todayCount > 1 ? 's' : ''} today` : 'No challenges today'}
                    </Text>
                  </View>
                  <View style={styles.appRight}>
                    {rate !== null ? (
                      <>
                        <Text style={styles.appRate}>
                          {rate}
                          <Text style={styles.appRateUnit}>%</Text>
                        </Text>
                        <Text style={styles.appRateLabel}>SUCCESS</Text>
                      </>
                    ) : (
                      <Text style={styles.appNoData}>—</Text>
                    )}
                  </View>
                </View>
                <View style={styles.appStatsRow}>
                  <View style={styles.appStatCell}>
                    <Text style={styles.appStatVal}>{total}</Text>
                    <Text style={styles.appStatLabel}>TOTAL</Text>
                  </View>
                  <View style={styles.appStatDivider} />
                  <View style={styles.appStatCell}>
                    <Text style={styles.appStatVal}>{successes}</Text>
                    <Text style={styles.appStatLabel}>WON</Text>
                  </View>
                  <View style={styles.appStatDivider} />
                  <View style={styles.appStatCell}>
                    <Text style={[styles.appStatVal, bestTime > 0 && styles.appStatAccent]}>
                      {bestTime > 0 ? `${bestTime.toFixed(2)}s` : '—'}
                    </Text>
                    <Text style={styles.appStatLabel}>BEST</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </>
      )}

      {monitoredApps.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>NO APPS SELECTED</Text>
          <Text style={styles.emptySub}>Choose which apps to monitor from the YOU tab.</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },
  content: { paddingTop: 52, paddingBottom: 48 },

  header: { paddingHorizontal: 20, marginBottom: 16 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },

  stCard: { backgroundColor: '#111111', borderRadius: 18, marginHorizontal: 16, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#1C1C1C' },
  stHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  stCardTitle: { color: '#666666', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  stTotal: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  stEmpty: { color: '#333333', fontSize: 12, lineHeight: 18 },
  stRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  stIcon: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  stIconText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  stApp: { color: '#DDDDDD', fontSize: 13, fontWeight: '800', width: 88 },
  stBarWrap: { flex: 1, height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, overflow: 'hidden' },
  stBar: { height: '100%', backgroundColor: '#CCFF00', borderRadius: 3 },
  stTime: { color: '#CCFF00', fontSize: 13, fontWeight: '900', width: 50, textAlign: 'right' },

  statusCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: 14,
    marginHorizontal: 16,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  statusDivider: { height: 1, backgroundColor: '#1A1A1A' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF1133' },
  statusDotOn: { backgroundColor: '#CCFF00' },
  statusLabel: { color: '#DDDDDD', fontSize: 13, fontWeight: '700' },
  statusOn: { color: '#CCFF00', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  statusFix: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  batteryHint: { color: '#555555', fontSize: 11, lineHeight: 16, marginHorizontal: 16, marginTop: -4, marginBottom: 16 },

  testCard: {
    backgroundColor: '#0A1400',
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E3300',
  },
  testCardTitle: { color: '#CCFF00', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
  testCardBody: { color: '#556644', fontSize: 12, lineHeight: 20, marginBottom: 16 },
  testBtn: {
    backgroundColor: '#CCFF00',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  testBtnSent: { backgroundColor: '#2A4400' },
  testBtnText: { color: '#000000', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  sectionLabel: { color: '#444444', fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10 },

  appCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1C1C1C',
  },
  appTopRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  appIcon: { width: 52, height: 52, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  appIconText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  appBody: { flex: 1 },
  appName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  appSub: { color: '#555555', fontSize: 11, marginTop: 3 },
  appRight: { alignItems: 'flex-end' },
  appRate: { color: '#CCFF00', fontSize: 24, fontWeight: '900' },
  appRateUnit: { fontSize: 13, color: '#778844' },
  appRateLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  appNoData: { color: '#333333', fontSize: 24, fontWeight: '900' },

  appStatsRow: { flexDirection: 'row', borderTopWidth: 1, borderColor: '#1C1C1C', paddingTop: 12 },
  appStatCell: { flex: 1, alignItems: 'center' },
  appStatVal: { color: '#DDDDDD', fontSize: 15, fontWeight: '900' },
  appStatAccent: { color: '#CCFF00' },
  appStatLabel: { color: '#444444', fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginTop: 2 },
  appStatDivider: { width: 1, backgroundColor: '#1C1C1C' },

  emptyCard: { backgroundColor: '#111111', borderRadius: 14, marginHorizontal: 16, padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#333333', fontSize: 13, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  emptySub: { color: '#2A2A2A', fontSize: 12, textAlign: 'center' },
});
