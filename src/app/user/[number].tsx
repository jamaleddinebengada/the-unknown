import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { traitRows } from '@/features/people/traits';
import { GiftSheet } from '@/features/wallet/GiftSheet';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { MaskAvatar } from '@/components/PersonAvatar';
import { PostCard } from '@/components/PostCard';
import { ReportSheet, type ReportTarget } from '@/components/SafetySheet';
import { ErrorState, T } from '@/components/ui';
import { interestLabel, LANGUAGES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, spacing } from '@/constants/theme';
import { nameOf, placeOf, usePersonActions } from '@/features/people/PersonCards';
import { usePaged } from '@/hooks/usePaged';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { friendlyError } from '@/lib/supabase';
import { blockUser, getPerson, getUserPosts, swipe } from '@/services/api';
import type { FeedPost, PersonCard } from '@/types/models';
import { haptic } from '@/utils/format';

const LOOKING: Record<string, string> = { friendship: 'Friendship', conversation: 'Conversation', relationship: 'Relationship' };

/** A member's profile: photos (when they allow it), basics, bio, interests, and actions. */
export default function UserProfile() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const n = Number(number);
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [p, setP] = useState<PersonCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [page, setPage] = useState(0);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [liking, setLiking] = useState(false);
  const [gift, setGift] = useState(false);
  const posts = usePaged<FeedPost>((o) => getUserPosts(n, o), String(n));
  const meta = usePersonMeta(p?.has_photo || p ? n : null);
  const actions = usePersonActions(setP);
  const photos = [meta?.photoUrl, ...(meta?.gallery ?? [])].filter(Boolean) as string[];
  const heroH = Math.min(width * 1.15, 520);

  useEffect(() => { getPerson(n).then(setP).catch((e) => setError(friendlyError(e))); }, [n]);
  useEffect(() => { if (p?.is_me) router.replace('/profile'); }, [p, router]);

  const like = async () => {
    if (!p) return;
    setLiking(true);
    try {
      const r = await swipe(n, 'like');
      setP({ ...p, i_liked: true });
      haptic.success();
      if (r.matched && r.conversation_id) { toast('It’s a match! 💙', 'success'); router.push({ pathname: '/conversation/[id]', params: { id: r.conversation_id } }); }
      else toast(`You liked ${nameOf(p)}. If they like you back, it’s a match.`, 'success');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setLiking(false); }
  };
  const block = () => {
    setMenu(false);
    Alert.alert(`Block ${p ? nameOf(p) : 'this member'}?`, 'You won’t see each other’s profiles, posts or messages anymore.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => { try { await blockUser(n); toast('Blocked.', 'success'); router.back(); } catch (e) { toast(friendlyError(e), 'error'); } } },
    ]);
  };

  if (error) return <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}><Back onPress={() => router.back()} /><ErrorState message={error} /></View>;
  if (!p) return <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;

  const header = (
    <View>
      <View style={{ width, height: heroH, backgroundColor: colors.bgSecondary }}>
        {photos.length ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {photos.map((u) => <Image key={u} source={{ uri: u }} style={{ width, height: heroH }} contentFit="cover" transition={250} accessibilityLabel={`${nameOf(p)}'s photo`} />)}
          </ScrollView>
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 10 }]}>
            <MaskAvatar seed={p.avatar_seed} size={140} name={p.display_name} />
            <T v="caption" color={colors.textMuted}>No public photos</T>
          </View>
        )}
        {photos.length > 1 && (
          <View style={[s.pager, { top: insets.top + 8 }]}>
            {photos.map((u, i) => <View key={u} style={[s.pagerBar, i === page && { backgroundColor: colors.white }]} />)}
          </View>
        )}
        <View style={[s.topBtns, { top: insets.top + 18 }]}>
          <Back onPress={() => router.back()} />
          <Pressable accessibilityLabel="More" onPress={() => setMenu(true)} style={s.glassBtn}><Ionicons name="ellipsis-horizontal" size={20} color={colors.text} /></Pressable>
        </View>
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={s.sheet}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.name} numberOfLines={1}>{nameOf(p)}{p.age ? `, ${p.age}` : ''}</Text>
          {p.is_verified && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
          {p.tier !== 'free' && <View style={s.vip}><Ionicons name="diamond" size={11} color="#5A4000" /><Text style={s.vipText}>{p.tier === 'vip' ? 'SVIP' : 'VIP'}</Text></View>}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {p.online ? <View style={s.statusPill}><View style={s.dot} /><Text style={s.statusText}>Online</Text></View>
            : p.recently_active ? <Text style={s.meta}>Active today</Text> : null}
          <Text style={s.meta}><Ionicons name="location-outline" size={13} color={colors.textMuted} /> {placeOf(p)}{p.country_code && p.city ? ` ${flagOf(p.country_code)}` : ''}</Text>
        </View>

        <View style={s.actions}>
          <ActionBtn icon={p.i_liked ? 'heart' : 'heart-outline'} label={p.i_liked ? 'Liked' : 'Like'} color={colors.coral} onPress={like} disabled={p.i_liked || liking} />
          <ActionBtn icon="chatbubble-ellipses" label="Say hi" color={colors.white} bg={colors.primary} onPress={() => actions.sayHi(p)} busy={actions.busy === `hi${n}`} />
          <ActionBtn icon={p.is_favorite ? 'star' : 'star-outline'} label={p.is_favorite ? 'Favorite' : 'Add'} color={colors.vip} onPress={() => actions.favorite(p)} />
          <ActionBtn icon="gift" label="Gift" color={colors.coral} onPress={() => setGift(true)} />
        </View>
        <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>“Say hi” sends a chat request. The conversation opens when they accept — or right away if you like each other.</T>

        {!!p.bio && <Section title="About"><T style={{ lineHeight: 22 }}>{p.bio}</T></Section>}
        <Section title="Basics">
          <View style={s.wrap}>
            {p.looking_for && <Pill icon="search" text={`Looking for ${LOOKING[p.looking_for]?.toLowerCase()}`} />}
            {p.gender && <Pill icon="person-outline" text={p.gender === 'nonbinary' ? 'Non-binary' : p.gender[0].toUpperCase() + p.gender.slice(1)} />}
            {p.country_code && <Pill text={`${flagOf(p.country_code)} ${countryName(p.country_code)}`} />}
            {p.languages.map((l) => <Pill key={l} icon="language-outline" text={LANGUAGES.find((x) => x.code === l)?.label ?? l} />)}
          </View>
        </Section>
        {traitRows(p.traits).length > 0 && (
          <Section title="Characteristics">
            <View style={s.traitGrid}>
              {traitRows(p.traits).map((r) => (
                <View key={r.key} style={s.trait}>
                  <View style={s.traitIcon}><Ionicons name={r.icon} size={16} color={colors.primary} /></View>
                  <Text style={s.traitText} numberOfLines={2}>{r.label}</Text>
                </View>
              ))}
            </View>
          </Section>
        )}
        {!!p.personality_tags?.length && (
          <Section title="Personality">
            <View style={s.wrap}>{p.personality_tags.map((t) => <Pill key={t} icon="sparkles-outline" text={t} />)}</View>
          </Section>
        )}
        {p.interests.length > 0 && (
          <Section title="Interests">
            <View style={s.wrap}>{p.interests.map((i) => <Pill key={i} text={interestLabel(i)} on={p.shared_interests.includes(i)} />)}</View>
          </Section>
        )}
        <Text style={s.section}>Moments</Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList data={posts.items} keyExtractor={(x) => x.id} ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item, index }) => <View style={{ paddingHorizontal: spacing.md }}><PostCard post={item} index={index} onChange={posts.update} onRemoved={posts.remove} /></View>}
        onEndReached={posts.loadMore}
        ListEmptyComponent={posts.loading ? <ActivityIndicator color={colors.primary} /> : <T color={colors.textMuted} style={{ textAlign: 'center', padding: spacing.lg }}>No public moments yet.</T>} />
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <SheetAction icon="share-outline" label="Share profile" onPress={() => { setMenu(false); Share.share({ message: `${nameOf(p)} on THE UNKNOWN` }).catch(() => {}); }} />
        <SheetAction icon="flag-outline" label="Report" onPress={() => { setMenu(false); setReportTarget({ type: 'user', number: n }); }} />
        <SheetAction icon="ban-outline" label="Block" danger onPress={block} />
      </BottomSheet>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
      {!p.is_me && <GiftSheet visible={gift} onClose={() => setGift(false)} number={n} />}
    </View>
  );
}

function Back({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityLabel="Back" onPress={onPress} style={s.glassBtn}><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 8, marginTop: spacing.md }}><Text style={s.section}>{title}</Text>{children}</View>;
}
function Pill({ text, icon, on }: { text: string; icon?: keyof typeof Ionicons.glyphMap; on?: boolean }) {
  return (
    <View style={[s.pill, on && { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
      {icon && <Ionicons name={icon} size={13} color={on ? colors.primary : colors.textSecondary} />}
      <Text style={[s.pillText, on && { color: colors.primary }]}>{text}</Text>
    </View>
  );
}
function ActionBtn({ icon, label, color, bg = colors.white, onPress, disabled, busy }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; bg?: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic.soft(); onPress(); }} disabled={disabled || busy}
      style={({ pressed }) => [s.action, { backgroundColor: bg, flex: bg === colors.white ? 1 : 1.6 }, pressed && { transform: [{ scale: 0.96 }] }]}>
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={20} color={color} />}
      <Text style={[s.actionText, { color: bg === colors.white ? colors.text : color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  topBtns: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', shadowColor: '#172339', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  pager: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  pagerBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  sheet: { marginTop: -24, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.bg, padding: spacing.lg, gap: 8 },
  name: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.5, color: colors.text, flexShrink: 1 },
  vip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.vip },
  vipText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#5A4000' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#E9F9EF' },
  statusText: { fontFamily: fonts.semibold, fontSize: 12, color: '#15803D' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online },
  meta: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  traitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trait: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  traitIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  traitText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  action: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  actionText: { fontFamily: fonts.semibold, fontSize: 14.5 },
  section: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, marginTop: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pillText: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
});
