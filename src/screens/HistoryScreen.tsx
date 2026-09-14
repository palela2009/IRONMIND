import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions } from 'react-native';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow, glowFor } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

// Nearly the full width of the screen. At thumbnail size a face is decoration; at this size
// the photo is the subject of the card and the text sits underneath it.
const PHOTO_W = width - spacing.xl * 2;
const PHOTO_H = Math.round(PHOTO_W * 0.92);

const CREATORS = [
  {
    name: 'Alexander Palelashvili',
    role: 'WEB & MOBILE DEVELOPER',
    photo: require('../../assets/alexander.jpg'),
    lines: [
      'Built IRONMIND end to end — the app you are holding, the Android service that notices the moment you open a distraction, and the backend behind streaks, duels and friends.',
      'Works across web and mobile.',
    ],
  },
  {
    name: 'Luka Berikelashvili',
    role: 'MARKETING & STRATEGY',
    photo: require('../../assets/luka.jpg'),
    lines: [
      'Shapes how IRONMIND reaches people and what it says when it gets there — the positioning, the words, and the reason someone gives it a try at all.',
      'A national AI olympiad competitor, and the more confident half of the pair.',
    ],
  },
];

export const HistoryScreen: React.FC<Props> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.hero}>
            <Image source={require('../../assets/icon.png')} style={styles.logo} />
            <Text style={styles.kicker}>EST. 2026 · TBILISI</Text>
            <Text style={styles.title}>THE STORY{'\n'}OF IRONMIND</Text>
            <View style={styles.rule} />
            <Text style={styles.lead}>
              Built by two students who were tired of losing hours to their own phones, and
              decided the fix was not another screen-time chart but a challenge you have to beat.
            </Text>
          </View>

          <View style={styles.quoteBlock}>
            <Text style={styles.quote}>
              Every app we tried showed us numbers after the damage was done. Nothing ever stood
              between us and the next scroll.
            </Text>
          </View>

          <Text style={styles.body}>
            So we built something that does. Open a distracting app and IRONMIND starts a timer.
            Beat it and your streak grows. Lose and it does not. Simple, and much harder to
            ignore than a weekly report.
          </Text>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>THE TWO OF US</Text>
            <View style={styles.dividerLine} />
          </View>

          {CREATORS.map((creator, i) => (
            <View key={creator.name} style={styles.person}>
              <View style={styles.photoWrap}>
                <Image source={creator.photo} style={styles.photo} resizeMode="cover" />
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>0{i + 1}</Text>
                </View>
              </View>

              <Text style={styles.personName}>{creator.name}</Text>
              <Text style={styles.personRole}>{creator.role}</Text>
              {creator.lines.map((line, k) => (
                <Text key={k} style={styles.personBio}>
                  {line}
                </Text>
              ))}
            </View>
          ))}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>WHERE WE ARE</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.factRow}>
            <View style={styles.fact}>
              <Text style={styles.factNum}>2009</Text>
              <Text style={styles.factLabel}>BOTH BORN</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={styles.factNum}>26/27</Text>
              <Text style={styles.factLabel}>FINAL YEAR</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={styles.factNum}>2</Text>
              <Text style={styles.factLabel}>OF US</Text>
            </View>
          </View>

          <Text style={styles.body}>
            We are in our final year at Komarovi in Tbilisi. IRONMIND was built around school,
            mostly late at night. We are aiming for good universities next, and building this
            taught us more than we expected about shipping something real to people who never
            asked for it.
          </Text>

          <View style={styles.thanks}>
            <Text style={styles.thanksText}>
              Thanks for using IRONMIND. Every streak in this app is someone taking a bit of
              their attention back.
            </Text>
            <Text style={styles.sign}>— Alexander & Luka</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 72 },

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

  hero: { marginBottom: spacing.xxl },
  logo: { width: 52, height: 52, borderRadius: 14, marginBottom: spacing.lg },
  kicker: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  title: {
    color: c.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 39,
    marginTop: spacing.sm,
  },
  rule: { width: 48, height: 3, borderRadius: 2, backgroundColor: c.accent, marginVertical: spacing.lg },
  lead: { color: c.textSecondary, fontSize: 15, lineHeight: 23 },

  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
    paddingLeft: spacing.lg,
    marginBottom: spacing.xl,
  },
  quote: { color: c.textPrimary, fontSize: 17, lineHeight: 26, fontWeight: '600', fontStyle: 'italic' },

  body: { color: c.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: spacing.xl },

  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },

  person: { marginBottom: spacing.xxl },
  photoWrap: { marginBottom: spacing.lg },
  photo: {
    width: PHOTO_W,
    height: PHOTO_H,
    borderRadius: radius.lg,
    backgroundColor: c.surfaceRaised,
    borderWidth: 2,
    borderColor: c.border,
  },
  photoBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: c.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...glowFor(c),
  },
  photoBadgeText: { color: c.accentContrast, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },

  personName: { color: c.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  personRole: {
    color: c.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  personBio: { color: c.textTertiary, fontSize: 13, lineHeight: 21, marginBottom: spacing.sm },

  factRow: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
    ...cardShadow,
  },
  fact: { flex: 1, alignItems: 'center' },
  factNum: { color: c.textPrimary, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  factLabel: { color: c.textFaint, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 3 },
  factDivider: { width: 1, backgroundColor: c.borderSubtle },

  thanks: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
  },
  thanksText: { color: c.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  sign: { color: c.accent, fontSize: 14, fontWeight: '900', marginTop: spacing.lg },
});
