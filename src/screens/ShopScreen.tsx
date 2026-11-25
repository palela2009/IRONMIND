import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert } from '../components/AppDialog';
import { useThemedStyles, useTheme } from '../context/ThemeContext';
import { Palette, PALETTES, paletteFor, radius, spacing, cardShadow } from '../theme';
import { usePro } from '../context/ProContext';
import { useAuth } from '../context/AuthContext';
import { FRAMES, NAME_EFFECTS, PRO_WEEK_PRICE, frameById, nameEffectById, glowStyle } from '../constants/cosmetics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type ShopTab = 'ALL' | 'THEMES' | 'FRAMES' | 'NAMES' | 'BOOSTS';

export const PRICES = { freeze: 100, reclaim: 200, theme: 200 };

export const ShopScreen: React.FC<Props> = ({ visible, onClose }) => {
  const styles = useThemedStyles(makeStyles);
  const activePalette = useTheme();
  const { fbUser } = useAuth();
  const {
    coins, streakFreezes, isPro, unlockedThemes, themeId, buyItem, setTheme,
    ownedFrames, ownedNameEffects, equippedFrame, equippedNameEffect, equipCosmetic,
    welcomeGiftAvailable, claimWelcomeGift, source,
  } = usePro();

  const [tab, setTab] = useState<ShopTab>('ALL');
  const [busy, setBusy] = useState<string | null>(null);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [previewFrameId, setPreviewFrameId] = useState<string | null>(null);
  const [previewNameId, setPreviewNameId] = useState<string | null>(null);

  const busyKey = (item: string, id?: string) => `${item}:${id ?? ''}`;

  const clearPreviews = () => {
    setPreviewThemeId(null);
    setPreviewFrameId(null);
    setPreviewNameId(null);
  };

  const buy = async (item: 'freeze' | 'theme' | 'frame' | 'nameEffect' | 'proWeek', id?: string) => {
    setBusy(busyKey(item, id));
    const result = await buyItem(item, item === 'theme' ? { themeId: id } : { cosmeticId: id });
    setBusy(null);
    if (!result.ok) {
      appAlert('Could not buy', result.message ?? 'Try again.');
      return;
    }
    if (item === 'theme' && id) {
      setPreviewThemeId(null);
      void setTheme(id);
    } else if (item === 'frame') {
      setPreviewFrameId(null);
    } else if (item === 'nameEffect') {
      setPreviewNameId(null);
    }
  };

  const confirmBuy = (label: string, price: number, item: 'freeze' | 'theme' | 'frame' | 'nameEffect' | 'proWeek', id?: string) => {
    if (coins < price) {
      appAlert('Not enough coins', `${label} costs ◉ ${price}. You have ◉ ${coins}. Win challenges or duels to earn more!`);
      return;
    }
    appAlert('Confirm purchase', `Buy ${label} for ◉ ${price}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => void buy(item, id) },
    ]);
  };

  const claimTheme = async (id: string) => {
    if (busy !== null) return;
    setBusy(busyKey('theme', id));
    try {
      const result = await claimWelcomeGift(id);
      if (!result.ok) appAlert('Could not claim gift', result.message ?? 'Try again.');
      else setPreviewThemeId(null);
    } finally { setBusy(null); }
  };

  const stagePalette = previewThemeId ? paletteFor(previewThemeId) : activePalette;
  const stageFrame = frameById(previewFrameId ?? equippedFrame);
  const stageNameFx = nameEffectById(previewNameId ?? equippedNameEffect);
  const isPreviewing = Boolean(previewThemeId || previewFrameId || previewNameId);

  const displayName = fbUser?.displayName || 'IRON ATHLETE';
  const initials = displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'IM';

  const showThemes = tab === 'ALL' || tab === 'THEMES';
  const showFrames = tab === 'ALL' || tab === 'FRAMES';
  const showNames = tab === 'ALL' || tab === 'NAMES';
  const showBoosts = tab === 'ALL' || tab === 'BOOSTS';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topBar}>
          <Text style={styles.title}>SHOP</Text>
          <View style={styles.topRight}>
            <View style={styles.coinBadge}>
              <Text style={styles.coinBadgeText}>◉ {coins.toLocaleString()}</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
          {([
            { id: 'ALL' as ShopTab, label: 'ALL' },
            { id: 'THEMES' as ShopTab, label: `THEMES (${PALETTES.length})` },
            { id: 'FRAMES' as ShopTab, label: 'FRAMES' },
            { id: 'NAMES' as ShopTab, label: 'NAMES' },
            { id: 'BOOSTS' as ShopTab, label: 'BOOSTS' },
          ]).map((t) => {
            const on = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabChip, on && styles.tabChipOn]}
                onPress={() => setTab(t.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabChipText, on && styles.tabChipTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.stageCard, { backgroundColor: stagePalette.surface, borderColor: stagePalette.accent }]}>
            <View style={[styles.stageAccentBar, { backgroundColor: stagePalette.accent }]} />
            <View style={styles.stageTop}>
              <Text style={[styles.stageKicker, { color: stagePalette.accent }]}>
                {isPreviewing ? 'LIVE PREVIEW' : 'YOUR CURRENT LOOK'}
              </Text>
              {isPreviewing ? (
                <TouchableOpacity onPress={clearPreviews} activeOpacity={0.8}>
                  <Text style={[styles.stageReset, { color: stagePalette.textSecondary }]}>RESET ↺</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.stageThemePill, { color: stagePalette.textTertiary }]}>
                  {stagePalette.name}
                </Text>
              )}
            </View>

            <View style={[styles.stageInner, { backgroundColor: stagePalette.bg, borderColor: stagePalette.border }]}>
              <View
                style={[
                  styles.stageAvatar,
                  { backgroundColor: stagePalette.accent },
                  stageFrame && {
                    borderWidth: 3,
                    borderColor: stageFrame.ring,
                    ...(stageFrame.glow ? { shadowColor: stageFrame.glow, shadowOpacity: 0.9, shadowRadius: 10, elevation: 8 } : {}),
                  },
                ]}
              >
                {fbUser?.photoURL ? (
                  <Image source={{ uri: fbUser.photoURL }} style={styles.stageAvatarImg} />
                ) : (
                  <Text style={[styles.stageInitials, { color: stagePalette.accentContrast }]}>{initials}</Text>
                )}
              </View>
              <View style={styles.stageBody}>
                <Text
                  style={[
                    styles.stageName,
                    { color: stagePalette.textPrimary },
                    stageNameFx ? [{ color: stageNameFx.color }, glowStyle(stageNameFx.glow)] : null,
                  ]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text style={[styles.stageSub, { color: stagePalette.textTertiary }]}>
                  {stageFrame ? `${stageFrame.name} Frame` : 'Standard Frame'}
                  {' · '}
                  {stageNameFx ? `${stageNameFx.name} Name` : 'Default Name'}
                </Text>
              </View>
              <View style={[styles.stagePill, { backgroundColor: stagePalette.accentMuted, borderColor: stagePalette.accentDim }]}>
                <Text style={[styles.stagePillText, { color: stagePalette.accent }]}>#1</Text>
              </View>
            </View>

            <Text style={[styles.stageHint, { color: stagePalette.textTertiary }]}>
              {isPro
                ? source === 'store'
                  ? 'Tap any item below to preview it live · Double coins + 500 monthly bonus active.'
                  : 'Tap any item below to preview it live · Pro double coins active.'
                : 'Tap any item below to preview it live · Win challenges (+10) & duels to earn coins.'}
            </Text>
          </View>

          {welcomeGiftAvailable && (
            <View style={styles.giftCard}>
              <Text style={styles.giftTitle}>🎁 FREE WELCOME THEME WAITING</Text>
              <Text style={styles.giftDescription}>
                Pick any Pro theme below to unlock forever for free — plus 1 free streak freeze. Your coins stay untouched.
              </Text>
            </View>
          )}

          {showThemes && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>{welcomeGiftAvailable ? 'PICK YOUR FREE THEME' : 'APP THEMES'}</Text>
                <Text style={styles.sectionHint}>Tap card to preview</Text>
              </View>
              <View style={styles.grid}>
                {PALETTES.map((p) => {
                  const owned = !p.pro || isPro || unlockedThemes.includes(p.id);
                  const active = themeId === p.id;
                  const previewed = previewThemeId === p.id;
                  const isGiftChoice = welcomeGiftAvailable && p.pro;
                  const isBusy = busy === busyKey('theme', p.id);

                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.themeTile,
                        { backgroundColor: p.surface, borderColor: active || previewed ? p.accent : p.border },
                      ]}
                      onPress={() => {
                        if (owned && !isGiftChoice) {
                          setPreviewThemeId(null);
                          void setTheme(p.id);
                        } else {
                          setPreviewThemeId(previewed ? null : p.id);
                        }
                      }}
                      activeOpacity={0.85}
                      disabled={busy !== null}
                    >
                      <View style={[styles.miniPhone, { backgroundColor: p.bg, borderColor: p.border }]}>
                        <View style={styles.miniTop}>
                          <View style={[styles.miniDot, { backgroundColor: p.accent }]} />
                          <View style={[styles.miniLineShort, { backgroundColor: p.surfaceRaised }]} />
                        </View>
                        <View style={[styles.miniCard, { backgroundColor: p.surfaceRaised }]}>
                          <View style={[styles.miniAccentBar, { backgroundColor: p.accent }]} />
                          <View style={[styles.miniLine, { backgroundColor: p.border }]} />
                        </View>
                      </View>

                      <Text style={[styles.tileName, { color: p.textPrimary }]}>{p.name}</Text>
                      <Text style={[styles.tileSub, { color: p.textTertiary }]} numberOfLines={1}>{p.tagline}</Text>

                      <TouchableOpacity
                        style={[
                          styles.tileAction,
                          active
                            ? { backgroundColor: p.accentMuted, borderColor: p.accent }
                            : isGiftChoice || !owned
                            ? { backgroundColor: p.accent, borderColor: p.accent }
                            : { backgroundColor: p.surfaceRaised, borderColor: p.border },
                        ]}
                        onPress={() =>
                          isGiftChoice
                            ? void claimTheme(p.id)
                            : owned
                            ? (setPreviewThemeId(null), void setTheme(p.id))
                            : confirmBuy(`the ${p.name} theme`, PRICES.theme, 'theme', p.id)
                        }
                        disabled={busy !== null}
                        activeOpacity={0.85}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={owned ? p.accent : p.accentContrast} size="small" />
                        ) : isGiftChoice ? (
                          <Text style={[styles.tileActionText, { color: p.accentContrast }]}>CLAIM FREE</Text>
                        ) : active ? (
                          <Text style={[styles.tileActionText, { color: p.accent }]}>ACTIVE ✓</Text>
                        ) : owned ? (
                          <Text style={[styles.tileActionText, { color: p.textPrimary }]}>EQUIP</Text>
                        ) : (
                          <Text style={[styles.tileActionText, { color: p.accentContrast }]}>◉ {PRICES.theme}</Text>
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {showFrames && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>AVATAR FRAMES</Text>
                <Text style={styles.sectionHint}>Shown on Home, Profile & Friends</Text>
              </View>
              <View style={styles.grid}>
                {FRAMES.map((f) => {
                  const owned = ownedFrames.includes(f.id);
                  const active = equippedFrame === f.id;
                  const previewed = previewFrameId === f.id;
                  const isBusy = busy === busyKey('frame', f.id);
                  const isRare = f.price >= 400;

                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.cosmeticTile,
                        (active || previewed) && { borderColor: f.ring },
                      ]}
                      onPress={() => {
                        if (owned) {
                          setPreviewFrameId(null);
                          void equipCosmetic('frame', active ? null : f.id);
                        } else {
                          setPreviewFrameId(previewed ? null : f.id);
                        }
                      }}
                      activeOpacity={0.85}
                      disabled={busy !== null}
                    >
                      {isRare && (
                        <View style={[styles.rareTag, { borderColor: f.ring }]}>
                          <Text style={[styles.rareTagText, { color: f.ring }]}>
                            {f.id === 'galactic' ? 'LEGENDARY' : 'RARE'}
                          </Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.framePreviewCircle,
                          { borderColor: f.ring },
                          f.glow ? { shadowColor: f.glow, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6 } : null,
                        ]}
                      >
                        {fbUser?.photoURL ? (
                          <Image source={{ uri: fbUser.photoURL }} style={styles.framePreviewImg} />
                        ) : (
                          <Text style={styles.framePreviewText}>{initials}</Text>
                        )}
                      </View>
                      <Text style={styles.tileName}>{f.name}</Text>
                      <Text style={styles.tileSub} numberOfLines={1}>{f.desc}</Text>

                      <TouchableOpacity
                        style={[
                          styles.tileAction,
                          active
                            ? { backgroundColor: activePalette.surfaceRaised, borderColor: f.ring }
                            : owned
                            ? { backgroundColor: activePalette.surfaceRaised, borderColor: activePalette.border }
                            : { backgroundColor: activePalette.accent, borderColor: activePalette.accent },
                        ]}
                        onPress={() =>
                          owned
                            ? (setPreviewFrameId(null), void equipCosmetic('frame', active ? null : f.id))
                            : confirmBuy(`the ${f.name} frame`, f.price, 'frame', f.id)
                        }
                        disabled={busy !== null}
                        activeOpacity={0.85}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={owned ? f.ring : activePalette.accentContrast} size="small" />
                        ) : active ? (
                          <Text style={[styles.tileActionText, { color: f.ring }]}>WORN ✓</Text>
                        ) : owned ? (
                          <Text style={[styles.tileActionText, { color: activePalette.textPrimary }]}>WEAR</Text>
                        ) : (
                          <Text style={[styles.tileActionText, { color: activePalette.accentContrast }]}>◉ {f.price}</Text>
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {showNames && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>NAME EFFECTS</Text>
                <Text style={styles.sectionHint}>Colors your handle everywhere</Text>
              </View>
              {NAME_EFFECTS.map((n) => {
                const owned = ownedNameEffects.includes(n.id);
                const active = equippedNameEffect === n.id;
                const previewed = previewNameId === n.id;
                const isBusy = busy === busyKey('nameEffect', n.id);

                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.nameCard, (active || previewed) && { borderColor: n.color }]}
                    onPress={() => {
                      if (owned) {
                        setPreviewNameId(null);
                        void equipCosmetic('nameEffect', active ? null : n.id);
                      } else {
                        setPreviewNameId(previewed ? null : n.id);
                      }
                    }}
                    activeOpacity={0.85}
                    disabled={busy !== null}
                  >
                    <View style={styles.nameCardLeft}>
                      <Text style={[styles.nameSample, { color: n.color }, glowStyle(n.glow)]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={styles.itemDesc}>{n.name} · {n.desc}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.rowPillBtn,
                        active
                          ? { borderColor: n.color, backgroundColor: activePalette.surfaceRaised }
                          : owned
                          ? { borderColor: activePalette.border, backgroundColor: activePalette.surfaceRaised }
                          : { borderColor: activePalette.accent, backgroundColor: activePalette.accent },
                      ]}
                      onPress={() =>
                        owned
                          ? (setPreviewNameId(null), void equipCosmetic('nameEffect', active ? null : n.id))
                          : confirmBuy(`the ${n.name} name effect`, n.price, 'nameEffect', n.id)
                      }
                      disabled={busy !== null}
                      activeOpacity={0.85}
                    >
                      {isBusy ? (
                        <ActivityIndicator color={owned ? n.color : activePalette.accentContrast} size="small" />
                      ) : active ? (
                        <Text style={[styles.rowPillText, { color: n.color }]}>WORN</Text>
                      ) : owned ? (
                        <Text style={[styles.rowPillText, { color: activePalette.textPrimary }]}>WEAR</Text>
                      ) : (
                        <Text style={[styles.rowPillText, { color: activePalette.accentContrast }]}>◉ {n.price}</Text>
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {showBoosts && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.section}>POWER-UPS & PRO</Text>
                <Text style={styles.sectionHint}>Protect streaks & double rewards</Text>
              </View>

              <TouchableOpacity
                style={styles.boostCard}
                onPress={() => confirmBuy('a streak freeze', PRICES.freeze, 'freeze')}
                activeOpacity={0.85}
                disabled={busy !== null}
              >
                <View style={styles.boostIconWrap}>
                  <Text style={styles.boostIcon}>❄</Text>
                </View>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>STREAK FREEZE</Text>
                  <Text style={styles.itemDesc}>Absorbs one missed challenge automatically · You have {streakFreezes}</Text>
                </View>
                <View style={styles.boostPricePill}>
                  {busy === busyKey('freeze') ? (
                    <ActivityIndicator color={activePalette.accentContrast} size="small" />
                  ) : (
                    <Text style={styles.boostPriceText}>◉ {PRICES.freeze}</Text>
                  )}
                </View>
              </TouchableOpacity>

              {!isPro && (
                <TouchableOpacity
                  style={[styles.boostCard, styles.proBoostCard]}
                  onPress={() => confirmBuy('7 days of IronMind Pro', PRO_WEEK_PRICE, 'proWeek')}
                  activeOpacity={0.85}
                  disabled={busy !== null}
                >
                  <View style={[styles.boostIconWrap, styles.proIconWrap]}>
                    <Text style={styles.proIcon}>★</Text>
                  </View>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName}>IRONMIND PRO · 7 DAYS</Text>
                    <Text style={styles.itemDesc}>All themes, 20 freezes, double coins & analytics · 1x/month</Text>
                  </View>
                  <View style={styles.boostPricePill}>
                    {busy === busyKey('proWeek') ? (
                      <ActivityIndicator color={activePalette.accentContrast} size="small" />
                    ) : (
                      <Text style={styles.boostPriceText}>◉ {PRO_WEEK_PRICE}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { color: c.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coinBadge: {
    backgroundColor: c.accentMuted,
    borderWidth: 1,
    borderColor: c.accentDim,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coinBadgeText: { color: c.accent, fontSize: 13, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.surfaceRaised, justifyContent: 'center', alignItems: 'center' },
  closeText: { color: c.textSecondary, fontSize: 14, fontWeight: '900' },

  tabScroll: { flexGrow: 0, marginBottom: spacing.sm },
  tabRow: { paddingHorizontal: spacing.lg, gap: 8, paddingVertical: 4 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  tabChipOn: { backgroundColor: c.accent, borderColor: c.accent },
  tabChipText: { color: c.textSecondary, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  tabChipTextOn: { color: c.accentContrast },

  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: 44 },

  stageCard: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...cardShadow,
  },
  stageAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  stageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  stageKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  stageReset: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  stageThemePill: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  stageInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  stageAvatar: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  stageAvatarImg: { width: '100%', height: '100%' },
  stageInitials: { fontSize: 18, fontWeight: '900' },
  stageBody: { flex: 1, minWidth: 0 },
  stageName: { fontSize: 16, fontWeight: '900' },
  stageSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  stagePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
  stagePillText: { fontSize: 12, fontWeight: '900' },
  stageHint: { fontSize: 11, lineHeight: 16, marginTop: spacing.md },

  giftCard: {
    backgroundColor: c.accentMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.accent,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  giftTitle: { color: c.accent, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  giftDescription: { color: c.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.md },
  section: { color: c.textPrimary, fontSize: 12, fontWeight: '900', letterSpacing: 0.9 },
  sectionHint: { color: c.textTertiary, fontSize: 11, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },

  themeTile: {
    width: '48.5%',
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.md,
  },
  miniPhone: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    marginBottom: 10,
    gap: 6,
  },
  miniTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniLineShort: { width: 38, height: 5, borderRadius: 3 },
  miniCard: { borderRadius: 6, padding: 7, gap: 5 },
  miniAccentBar: { width: '68%', height: 6, borderRadius: 3 },
  miniLine: { width: '45%', height: 4, borderRadius: 2 },

  cosmeticTile: {
    width: '48.5%',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  rareTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  rareTagText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  framePreviewCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: c.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 10,
  },
  framePreviewImg: { width: '100%', height: '100%' },
  framePreviewText: { color: c.textPrimary, fontSize: 16, fontWeight: '900' },

  tileName: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  tileSub: { color: c.textTertiary, fontSize: 11, marginTop: 2, marginBottom: 10 },
  tileAction: {
    alignSelf: 'stretch',
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActionText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  nameCardLeft: { flex: 1, minWidth: 0 },
  nameSample: { fontSize: 17, fontWeight: '900' },
  rowPillBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 74,
    alignItems: 'center',
  },
  rowPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  boostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  proBoostCard: { borderColor: c.accentDim, backgroundColor: c.accentMuted },
  boostIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  proIconWrap: { backgroundColor: c.accent },
  boostIcon: { color: '#9FD8FF', fontSize: 22 },
  proIcon: { color: c.accentContrast, fontSize: 22 },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { color: c.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.4 },
  itemDesc: { color: c.textTertiary, fontSize: 11, marginTop: 3, lineHeight: 15 },
  boostPricePill: {
    backgroundColor: c.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 68,
    alignItems: 'center',
  },
  boostPriceText: { color: c.accentContrast, fontSize: 12, fontWeight: '900' },
});
