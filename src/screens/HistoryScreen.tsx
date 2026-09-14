import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CREATORS = [
  {
    name: 'Alexander Palelashvili',
    role: 'Web & mobile developer',
    photo: require('../../assets/alexander.jpg'),
    bio: 'Built IRONMIND — the app, the Android service that watches for distractions, and the backend behind streaks, duels and friends. Works across web and mobile.',
  },
  {
    name: 'Luka Berikelashvili',
    role: 'Marketing & strategy',
    photo: require('../../assets/luka.jpg'),
    bio: 'Shapes how IRONMIND reaches people and what it says when it gets there. A national AI olympiad competitor, and the more confident half of the pair.',
  },
];

export const HistoryScreen: React.FC<Props> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);
  const palette = useTheme();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>THE STORY OF{'\n'}IRONMIND</Text>

          <Text style={styles.lead}>
            IRONMIND was built by two students in Tbilisi who were tired of losing hours to
            their own phones — and decided the fix was not another screen-time chart, but a
            challenge you have to beat.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>THE IDEA</Text>
            <Text style={styles.body}>
              Every app that promised to help just showed us numbers after the damage was done.
              Nothing stood between us and the next scroll. So we built something that does:
              open a distracting app and IRONMIND starts a timer. Beat it and your streak grows.
              Lose and it does not. Simple, and much harder to ignore than a weekly report.
            </Text>
          </View>

          <Text style={styles.section}>THE TWO OF US</Text>

          {CREATORS.map((c) => (
            <View key={c.name} style={styles.person}>
              <Image source={c.photo} style={styles.photo} />
              <View style={styles.personBody}>
                <Text style={styles.personName}>{c.name}</Text>
                <Text style={styles.personRole}>{c.role}</Text>
                <Text style={styles.personBio}>{c.bio}</Text>
              </View>
            </View>
          ))}

          <View style={styles.card}>
            <Text style={styles.cardLabel}>WHERE WE ARE</Text>
            <Text style={styles.body}>
              We were both born in 2009 and are in our final year at Komarovi in Tbilisi for
              2026/2027. IRONMIND was built around school, mostly late at night. We are aiming
              for good universities next — and building this taught us more than we expected
              about shipping something real to people who did not ask for it.
            </Text>
          </View>

          <Text style={styles.footer}>
            Thanks for using IRONMIND. Every streak on this app is someone taking a bit of
            their attention back.
          </Text>

          <Text style={styles.sign}>— Alexander & Luka</Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { padding: spacing.xl, paddingTop: 60, paddingBottom: 60 },

  close: {
    position: 'absolute',
    top: 52,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  logo: { width: 56, height: 56, borderRadius: 14, marginBottom: spacing.lg },
  title: { color: c.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },
  lead: {
    color: c.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...cardShadow,
  },
  cardLabel: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.sm },
  body: { color: c.textSecondary, fontSize: 13, lineHeight: 20 },

  section: {
    color: c.textTertiary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },

  person: {
    flexDirection: 'row',
    gap: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  photo: { width: 68, height: 68, borderRadius: 20, borderWidth: 2, borderColor: c.accent },
  personBody: { flex: 1 },
  personName: { color: c.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: -0.2 },
  personRole: { color: c.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  personBio: { color: c.textTertiary, fontSize: 12, lineHeight: 18, marginTop: spacing.sm },

  footer: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  sign: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
