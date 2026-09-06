import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { usePro } from '../context/ProContext';
import { PRO_PLANS, PRO_FEATURES, ProPlanId } from '../constants/pro';

interface ProScreenProps {
  visible: boolean;
  onClose: () => void;
}

export const ProScreen: React.FC<ProScreenProps> = ({ visible, onClose }) => {
  const { isPro, plan, expiresAt, streakFreezes, activate, cancel } = usePro();
  const [busy, setBusy] = useState<ProPlanId | null>(null);

  const handleSelect = async (planId: ProPlanId) => {
    setBusy(planId);
    const ok = await activate(planId);
    setBusy(null);

    if (!ok) {
      Alert.alert(
        'Not available yet',
        'In-app purchases are not live yet. They will switch on once IronMind is published to Google Play.'
      );
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Pro?', 'This drops you back to the free tier.', [
      { text: 'Keep Pro', style: 'cancel' },
      {
        text: 'Cancel Pro',
        style: 'destructive',
        onPress: async () => {
          const ok = await cancel();
          if (!ok) Alert.alert('Could not cancel', 'Try again.');
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.brand}>IRONMIND</Text>
          <Text style={styles.brandPro}>PRO</Text>

          {isPro ? (
            <View style={styles.activeCard}>
              <Text style={styles.activeTitle}>PRO ACTIVE</Text>
              <Text style={styles.activeSub}>
                {plan === 'lifetime'
                  ? 'Lifetime access — never expires.'
                  : expiresAt
                  ? `${plan?.toUpperCase()} · renews ${new Date(expiresAt).toLocaleDateString()}`
                  : plan?.toUpperCase()}
              </Text>
              <Text style={styles.activeFreezes}>{streakFreezes} streak freezes remaining</Text>
            </View>
          ) : (
            <Text style={styles.tagline}>
              Protect your streak. Unlock the full picture of your habits.
            </Text>
          )}

          <View style={styles.features}>
            {PRO_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {!isPro && (
            <>
              <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
              {PRO_PLANS.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.planCard, p.id === 'annual' && styles.planCardFeatured]}
                  onPress={() => handleSelect(p.id)}
                  activeOpacity={0.85}
                  disabled={busy !== null}
                >
                  <View style={styles.planLeft}>
                    <Text style={styles.planTitle}>{p.title}</Text>
                    <Text style={styles.planCadence}>
                      {p.cadence}
                      {p.perMonth ? ` · ${p.perMonth}` : ''}
                    </Text>
                  </View>
                  <View style={styles.planRight}>
                    {busy === p.id ? (
                      <ActivityIndicator color="#CCFF00" size="small" />
                    ) : (
                      <Text style={styles.planPrice}>{p.price}</Text>
                    )}
                    {p.note && <Text style={styles.planNote}>{p.note}</Text>}
                  </View>
                </TouchableOpacity>
              ))}

              <Text style={styles.legal}>
                Subscriptions renew automatically until cancelled. Manage or cancel any time in
                Google Play. Lifetime is a single payment with no renewal.
              </Text>
            </>
          )}

          {isPro && (
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.8}>
              <Text style={styles.cancelText}>CANCEL PRO</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090B' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 48 },

  close: { position: 'absolute', top: 52, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: '#16181C', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  closeText: { color: '#9A9DA5', fontSize: 14, fontWeight: '900' },

  brand: { color: '#F5F6F7', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  brandPro: { color: '#CCFF00', fontSize: 46, fontWeight: '900', letterSpacing: -2, marginTop: -8, marginBottom: 12 },
  tagline: { color: '#9A9DA5', fontSize: 14, lineHeight: 20, marginBottom: 28 },

  activeCard: { backgroundColor: '#0F1500', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#2E3D00', marginBottom: 28 },
  activeTitle: { color: '#CCFF00', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  activeSub: { color: '#9A9DA5', fontSize: 12, marginTop: 6 },
  activeFreezes: { color: '#5A5D64', fontSize: 11, marginTop: 10, fontWeight: '700' },

  features: { gap: 18, marginBottom: 32 },
  featureRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  featureIcon: { color: '#CCFF00', fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  featureBody: { flex: 1 },
  featureTitle: { color: '#F5F6F7', fontSize: 14, fontWeight: '800', marginBottom: 3 },
  featureText: { color: '#5A5D64', fontSize: 12, lineHeight: 17 },

  sectionLabel: { color: '#5A5D64', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131418',
    borderRadius: 14,
    padding: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#212328',
  },
  planCardFeatured: { borderColor: '#CCFF00', backgroundColor: '#101403' },
  planLeft: { flex: 1 },
  planTitle: { color: '#F5F6F7', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  planCadence: { color: '#5A5D64', fontSize: 11, marginTop: 3 },
  planRight: { alignItems: 'flex-end' },
  planPrice: { color: '#CCFF00', fontSize: 20, fontWeight: '900' },
  planNote: { color: '#7A9900', fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },

  legal: { color: '#35373C', fontSize: 10, lineHeight: 15, marginTop: 14 },

  cancelBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  cancelText: { color: '#5A5D64', fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
});
