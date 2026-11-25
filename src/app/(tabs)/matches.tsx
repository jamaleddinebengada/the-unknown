import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { HeartBurst } from '@/components/Effects';
import { useToast } from '@/components/Overlay';
import { PersonAvatar } from '@/components/PersonAvatar';
import { GradientButton, T } from '@/components/ui';
import { interestLabel } from '@/constants/content';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlan } from '@/features/membership/usePlan';
import { nameOf, PersonPhoto, placeOf, usePersonActions } from '@/features/people/PersonCards';
import { friendlyError } from '@/lib/supabase';
import { discoverPeople, getMyLikes, getMyNearby, swipe } from '@/services/api';
import type { PersonCard } from '@/types/models';
import { haptic } from '@/utils/format';

type Tab = 'deck' | 'likes';
const SWIPE = 110;

function Round({ icon, color, bg, size = 60, onPress, label, disabled }: { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; size?: number; onPress: () => void; label: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => { haptic.soft(); onPress(); }}
      style={({ pressed }) => [s.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
      <Ionicons name={icon} size={size * 0.45} color={color} />
    </Pressable>
  );
}

/** Mutual match celebration — only shown when the server confirms both people liked each other. */
function MatchModal({ person, myNumber, mySeed, onChat, onClose }: { person: PersonCard | null; myNumber: number; mySeed: string; onChat: () => void; onClose: () => void }) {
  return (
    <Modal visible={!!person} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalBg}>
        {person && (
          <Animated.View entering={ZoomIn.springify().damping(12)} style={s.modal}>
            <HeartBurst trigger={1} size={160} />
            <Text style={s.modalTitle}>It’s a match!</Text>
            <T color={colors.textSecondary} style={{ textAlign: 'center' }}>You and {nameOf(person)} liked each other.</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
              <PersonAvatar seed={mySeed} number={myNumber} size={92} />
              <View style={s.heartMid}><Ionicons name="heart" size={22} color={colors.white} /></View>
              <PersonAvatar seed={person.avatar_seed} number={person.has_photo ? person.unknown_number : null} name={person.display_name} size={92} />
            </View>
            <GradientButton icon="chatbubble-ellipses" label="Send a message" onPress={onChat} style={{ alignSelf: 'stretch' }} />
            <Pressable onPress={onClose} style={{ padding: 12 }}><Text style={s.link}>Keep discovering</Text></Pressable>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

export default function Matches() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { profile } = useAuth();
  const plan = usePlan();
  const [tab, setTab] = useState<Tab>('deck');
  const [deck, setDeck] = useState<PersonCard[]>([]);
  const [scope, setScope] = useState<'nearby' | 'world'>('world');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [likes, setLikes] = useState<{ count: number; locked: boolean; people: PersonCard[] } | null>(null);
  const [match, setMatch] = useState<{ p: PersonCard; conv?: string } | null>(null);
  const actions = usePersonActions((p) => setDeck((d) => d.map((x) => (x.unknown_number === p.unknown_number ? p : x))));
  const cardW = width - spacing.md * 2;
  const cardH = Math.min(cardW * 1.38, height - insets.top - 260);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const st = await getMyNearby().catch(() => null);
      const sc = st?.enabled && !st.expired ? 'nearby' : 'world';
      setScope(sc);
      setDeck(await discoverPeople(sc, 100, {}, 'suggested', true, 0, 30));
      getMyLikes().then(setLikes).catch(() => {});
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setLoading(false); }
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const top = deck[0];
  const act = async (action: 'like' | 'skip' | 'super') => {
    if (!top || busy) return;
    if (action === 'super' && plan?.tier === 'free') { toast('Super Like is part of VIP.'); router.push('/premium'); return; }
    setBusy(true);
    try {
      const r = await swipe(top.unknown_number, action);
      setDeck((d) => d.slice(1));
      if (r.matched) { haptic.success(); setMatch({ p: top, conv: r.conversation_id }); }
      else if (action !== 'skip') haptic.tap();
      if (deck.length <= 3) discoverPeople(scope, 100, {}, 'suggested', true, 0, 30).then((more) => setDeck((d) => [...d, ...more.filter((m) => !d.some((x) => x.unknown_number === m.unknown_number) && m.unknown_number !== top.unknown_number)])).catch(() => {});
    } catch (e) {
      toast(friendlyError(e), 'error');
      if (String((e as Error)?.message).includes('like_limit_reached')) router.push('/premium');
    } finally { setBusy(false); }
  };

  const x = useSharedValue(0);
  const pan = Gesture.Pan().enabled(!!top && !busy).activeOffsetX([-12, 12])
    .onUpdate((e) => { x.value = e.translationX; })
    .onEnd((e) => {
      if (e.translationX > SWIPE) { x.value = withTiming(700, { duration: 200 }, () => { x.value = 0; }); scheduleOnRN(act, 'like'); }
      else if (e.translationX < -SWIPE) { x.value = withTiming(-700, { duration: 200 }, () => { x.value = 0; }); scheduleOnRN(act, 'skip'); }
      else x.value = withSpring(0, { damping: 15 });
    });
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotateZ: `${interpolate(x.value, [-300, 300], [-10, 10])}deg` }] }));
  const likeHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, SWIPE], [0, 1], 'clamp') }));
  const nopeHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE, -20], [1, 0], 'clamp') }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 6 }}>
      <View style={s.head}>
        <Text style={s.title}>Matches</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push('/mystery')} style={s.mystery} accessibilityRole="button">
          <Ionicons name="sparkles" size={15} color={colors.primary} /><Text style={s.mysteryText}>Mystery Match</Text>
        </Pressable>
      </View>
      <View style={s.tabs}>
        {([['deck', 'Discover'], ['likes', `Likes you${likes?.count ? ` · ${likes.count}` : ''}`]] as [Tab, string][]).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabText, tab === k && { color: colors.white }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'deck' ? (
        loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} /> : !top ? (
          <View style={s.empty}>
            <Ionicons name="people-circle-outline" size={72} color={colors.skyDeep} />
            <Text style={s.emptyTitle}>You’ve seen everyone for now</Text>
            <T color={colors.textMuted} style={{ textAlign: 'center' }}>Only real members appear here. New people join every day — come back soon, or widen your Nearby area.</T>
            <GradientButton small label="Refresh" icon="refresh" onPress={load} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            {deck[1] && <View style={[s.under, { width: cardW - 24, height: cardH }]} />}
            <GestureDetector gesture={pan}>
              <Animated.View key={top.unknown_number} entering={FadeIn.duration(200)} style={[s.card, { width: cardW, height: cardH }, cardStyle]}>
                <Pressable onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(top.unknown_number) } })} style={{ flex: 1 }}>
                  <PersonPhoto p={top} width={cardW} height={cardH} radius={24} />
                  <View style={s.info}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text numberOfLines={1} style={s.name}>{nameOf(top)}{top.age ? `, ${top.age}` : ''}</Text>
                      {top.is_verified && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      {top.online && <View style={s.dot} />}
                    </View>
                    <Text style={s.place} numberOfLines={1}>{placeOf(top)}</Text>
                    {!!top.bio && <Text style={s.bio} numberOfLines={2}>{top.bio}</Text>}
                    {top.shared_interests.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {top.shared_interests.slice(0, 3).map((i) => <View key={i} style={s.tag}><Text style={s.tagText}>{interestLabel(i)}</Text></View>)}
                      </View>
                    )}
                  </View>
                </Pressable>
                <Animated.View style={[s.stamp, { left: 18, borderColor: colors.online }, likeHint]}><Text style={[s.stampText, { color: colors.online }]}>LIKE</Text></Animated.View>
                <Animated.View style={[s.stamp, { right: 18, borderColor: colors.textMuted }, nopeHint]}><Text style={[s.stampText, { color: colors.textMuted }]}>SKIP</Text></Animated.View>
              </Animated.View>
            </GestureDetector>
            <View style={s.actions}>
              <Round label="Skip" icon="close" color={colors.textMuted} bg={colors.white} onPress={() => act('skip')} disabled={busy} />
              <Round label="Super like (VIP)" icon="star" size={50} color="#5A4000" bg={colors.vip} onPress={() => act('super')} disabled={busy} />
              <Round label="Like" icon="heart" size={68} color={colors.white} bg={colors.coral} onPress={() => act('like')} disabled={busy} />
              <Round label={top.is_favorite ? 'Remove favorite' : 'Favorite'} icon={top.is_favorite ? 'bookmark' : 'bookmark-outline'} size={50} color={colors.primary} bg={colors.white} onPress={() => actions.favorite(top)} />
            </View>
            <T v="caption" color={colors.textMuted}>{scope === 'nearby' ? 'People near you' : 'People worldwide'} · swipe right to like, left to skip</T>
          </View>
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: 120 }}>
          {!likes ? <ActivityIndicator color={colors.primary} /> : likes.locked ? (
            <View style={s.locked}>
              <LinearGradient colors={gradients.gold} style={s.lockIcon}><Ionicons name="heart" size={30} color="#5A4000" /></LinearGradient>
              <Text style={s.emptyTitle}>{likes.count ? `${likes.count} ${likes.count === 1 ? 'person likes' : 'people like'} you` : 'No new likes yet'}</Text>
              <T color={colors.textMuted} style={{ textAlign: 'center' }}>VIP members can see who liked them and match instantly. Everyone can still match by liking back in Discover.</T>
              <GradientButton icon="diamond" label="See who likes you" colors={gradients.gold} onPress={() => router.push('/premium')} style={{ alignSelf: 'stretch' }} />
            </View>
          ) : likes.people.length === 0 ? (
            <View style={s.empty}><Ionicons name="heart-outline" size={60} color={colors.skyDeep} /><Text style={s.emptyTitle}>No new likes yet</Text></View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {likes.people.map((p) => (
                <Pressable key={p.unknown_number} onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(p.unknown_number) } })} style={{ width: (width - spacing.md * 2 - 12) / 2, gap: 6 }}>
                  <PersonPhoto p={p} width={(width - spacing.md * 2 - 12) / 2} height={((width - spacing.md * 2 - 12) / 2) * 1.25} radius={16} />
                  <Text numberOfLines={1} style={[s.name, { fontSize: 15 }]}>{p.super ? '⭐ ' : ''}{nameOf(p)}{p.age ? `, ${p.age}` : ''}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <MatchModal person={match?.p ?? null} myNumber={profile?.unknown_number ?? 0} mySeed={profile?.avatar_seed ?? 'me'}
        onClose={() => setMatch(null)}
        onChat={() => { const c = match?.conv; setMatch(null); if (c) router.push({ pathname: '/conversation/[id]', params: { id: c } }); }} />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.6, color: colors.text },
  mystery: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft },
  mysteryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  tab: { paddingHorizontal: 16, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  card: { borderRadius: 24, backgroundColor: colors.white, shadowColor: '#172339', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  under: { position: 'absolute', top: 18, borderRadius: 24, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  info: { position: 'absolute', left: 12, right: 12, bottom: 12, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.95)', gap: 2 },
  name: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, flexShrink: 1 },
  place: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
  bio: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.online },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySoft },
  tagText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primary },
  stamp: { position: 'absolute', top: 24, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.9)' },
  stampText: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16, marginBottom: 8 },
  round: { alignItems: 'center', justifyContent: 'center', shadowColor: '#172339', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  empty: { alignItems: 'center', gap: 8, padding: spacing.xl, marginTop: 40 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 19, color: colors.text, textAlign: 'center' },
  locked: { alignItems: 'center', gap: 10, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  lockIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(23,35,57,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modal: { width: '100%', maxWidth: 380, alignItems: 'center', gap: 6, padding: spacing.xl, borderRadius: 28, backgroundColor: colors.white },
  modalTitle: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.coral },
  heartMid: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', marginHorizontal: -12, zIndex: 2, borderWidth: 3, borderColor: colors.white },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
});
