import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Dimensions, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../context/ThemeContext';
import { Palette, radius, spacing, cardShadow, glowFor } from '../theme';
import { fetchInviteCode, inviteMessage } from '../hooks/useInvites';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');
const PHOTO_W = width - spacing.xl * 2 - 28;
const fullHeight = (ratio: number) => Math.round(PHOTO_W * ratio);
const visibleHeight = (ratio: number, cropTop: number) => Math.round(fullHeight(ratio) * (1 - cropTop));

const TIMELINE = [
  { num: '01', title: 'THE LATE-NIGHT PROBLEM', body: 'Two students at Komarovi losing hours to Reels and Shorts — realizing screen-time charts only show damage after it happens.' },
  { num: '02', title: 'BUILT FOR REAL LIFE', body: 'Hard app blockers got uninstalled in a day because you still need DMs and YouTube lectures. So we built scroll-only detection.' },
  { num: '03', title: 'TURNED INTO A GAME', body: 'Timed reflex challenges, streaks, freezes, coin-staked friend duels, and a community taking their attention back together.' },
];

const CREATORS = [
  {
    name: 'Alexander Palelashvili',
    role: 'ENGINEERING & ANDROID',
    photo: require('../../assets/alexander.jpg'),
    ratio: 1.9,
    cropTop: 0.25,
    lines: [
      'Built IRONMIND end to end — the app in your hands, the Android scroll-detection engine, and the backend powering streaks, duels, and friends.',
      'Ships across mobile and web.',
    ],
  },
  {
    name: 'Luka Berikelashvili',
    role: 'GROWTH & STRATEGY',
    photo: require('../../assets/luka.jpg'),
    ratio: 1.5,
    cropTop: 0,
    lines: [
      'Shapes how IRONMIND reaches people and what it stands for — the positioning, the voice, and why someone decides to fight back against the feed.',
      'National AI Olympiad competitor, and the louder half of the pair.',
    ],
  },
];

export const HistoryScreen: React.FC<Props> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);

  const handleShare = async () => {
    const code = await fetchInviteCode();
    const message = code
      ? inviteMessage(code)
      : 'Check out IRONMIND — catches you mid-doomscroll on Reels, TikTok, Shorts & Spotlight without blocking DMs: https://play.google.com/store/apps/details?id=com.palelastudio.ironmind';
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>OUR STORY</Text>
          <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroAccentBar} />
            <View style={styles.heroTop}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} />
              <View style={styles.originPill}>
                <Text style={styles.originText}>EST. 2026 · TBILISI</Text>
              </View>
            </View>
            <Text style={styles.title}>THE STORY{'\n'}OF IRONMIND.</Text>
            <Text style={styles.lead}>
              Built late at night by two students tired of losing hours to their own phones — who decided the cure wasn't another guilt chart, but a reflex game you have to beat mid-scroll.
            </Text>
          </View>

          <View style={styles.quoteBlock}>
            <Text style={styles.quote}>
              "Every app showed us numbers after the damage was done. Nothing stood between us and the next scroll — without locking us out of our own phones."
            </Text>
          </View>

          <Text style={styles.sectionLabel}>HOW IT HAPPENED</Text>
          <View style={styles.timelineCard}>
            {TIMELINE.map((t, idx) => (
              <View key={t.num} style={[styles.timelineRow, idx > 0 && styles.timelineDivided]}>
                <View style={styles.timelineNum}>
                  <Text style={styles.timelineNumText}>{t.num}</Text>
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{t.title}</Text>
                  <Text style={styles.timelineDesc}>{t.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.sectionLabel}>THE TWO FOUNDERS</Text>
          {CREATORS.map((creator, i) => (
            <View key={creator.name} style={styles.personCard}>
              <View style={[styles.photoWrap, { height: visibleHeight(creator.ratio, creator.cropTop) }]}>
                <Image
                  source={creator.photo}
                  style={[
                    styles.photo,
                    {
                      height: fullHeight(creator.ratio),
                      marginTop: -Math.round(fullHeight(creator.ratio) * creator.cropTop),
                    },
                  ]}
                  resizeMode="cover"
                />
                <View style={styles.photoBadge}>
                  <Text style={styles.photoBadgeText}>0{i + 1}</Text>
                </View>
              </View>

              <View style={styles.personHead}>
                <Text style={styles.personName}>{creator.name}</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.personRole}>{creator.role}</Text>
                </View>
              </View>
              {creator.lines.map((line, k) => (
                <Text key={k} style={styles.personBio}>{line}</Text>
              ))}
            </View>
          ))}

          <View style={styles.factRow}>
            <View style={styles.fact}>
              <Text style={styles.factNum}>2009</Text>
              <Text style={styles.factLabel}>BOTH BORN</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={styles.factNum}>KOMAROVI</Text>
              <Text style={styles.factLabel}>TBILISI</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={styles.factNum}>2</Text>
              <Text style={styles.factLabel}>BUILDERS</Text>
            </View>
          </View>

          <View style={styles.thanks}>
            <Text style={styles.thanksTitle}>THANK YOU FOR BEING HERE.</Text>
            <Text style={styles.thanksText}>
              We're building IRONMIND around our final year at Komarovi while aiming for great universities next. Every streak you protect here means the world to us.
            </Text>
            <Text style={styles.sign}>— Alexander & Luka</Text>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>SHARE IRONMIND WITH A FRIEND →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  topBarTitle: { color: c.textTertiary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  close: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 64 },

  heroCard: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  heroAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: c.accent },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  logo: { width: 46, height: 46, borderRadius: 13 },
  originPill: { backgroundColor: c.accentMuted, borderWidth: 1, borderColor: c.accentDim, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  originText: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: c.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: -1.2, lineHeight: 36, marginBottom: spacing.md },
  lead: { color: c.textSecondary, fontSize: 14, lineHeight: 22 },

  quoteBlock: {
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
    paddingLeft: spacing.lg,
    paddingVertical: 4,
    marginBottom: spacing.xl,
  },
  quote: { color: c.textPrimary, fontSize: 16, lineHeight: 24, fontWeight: '700', fontStyle: 'italic' },

  sectionLabel: { color: c.textTertiary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: spacing.md },

  timelineCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  timelineRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm },
  timelineDivided: { borderTopWidth: 1, borderColor: c.borderSubtle, paddingTop: spacing.md, marginTop: spacing.xs },
  timelineNum: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  timelineNumText: { color: c.accent, fontSize: 11, fontWeight: '900' },
  timelineBody: { flex: 1 },
  timelineTitle: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  timelineDesc: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },

  personCard: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    marginBottom: spacing.lg,
    ...cardShadow,
  },
  photoWrap: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
  },
  photo: { width: PHOTO_W },
  photoBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    backgroundColor: c.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    ...glowFor(c),
  },
  photoBadgeText: { color: c.accentContrast, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  personHead: { marginBottom: spacing.sm },
  personName: { color: c.textPrimary, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  rolePill: { alignSelf: 'flex-start', backgroundColor: c.accentMuted, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  personRole: { color: c.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  personBio: { color: c.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: spacing.xs },

  factRow: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  fact: { flex: 1, alignItems: 'center' },
  factNum: { color: c.accent, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  factLabel: { color: c.textTertiary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 4 },
  factDivider: { width: 1, backgroundColor: c.borderSubtle },

  thanks: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.accentDim,
    padding: spacing.xl,
    alignItems: 'center',
  },
  thanksTitle: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.sm },
  thanksText: { color: c.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  sign: { color: c.textPrimary, fontSize: 14, fontWeight: '900', marginTop: spacing.md, marginBottom: spacing.lg },
  shareBtn: { alignSelf: 'stretch', backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { color: c.accentContrast, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
});
