import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiPortrait } from '@/components/AiPortrait';
import { MaskLogo } from '@/components/Brand';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { useAiCharacters } from '@/features/ai/useAiCharacters';
import { Aurora } from '@/components/Effects';
import { PostCard } from '@/components/PostCard';
import { CategoryChip, EmptyState, ErrorState, IconButton, PostSkeleton, T } from '@/components/ui';
import { FEED_CATEGORIES, type FeedCategory } from '@/constants/content';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { useBadges } from '@/hooks/useBadges';
import { usePaged } from '@/hooks/usePaged';
import { getActiveStrangers, getFeed } from '@/services/api';
import { MatchesView } from '@/features/matches/MatchesView';
import { haptic } from '@/utils/format';
import type { FeedPost } from '@/types/models';


type View_ = 'feed' | 'match';

/** Two-way switch at the top of Discover: the anonymous feed, or Mystery Match. */
function ViewSwitch({ value, onChange }: { value: View_; onChange: (v: View_) => void }) {
  const opts: { key: View_; label: string }[] = [{ key: 'feed', label: 'Feed' }, { key: 'match', label: 'Mystery Match' }];
  return (
    <View style={styles.switch}>
      {opts.map((o) => {
        const on = value === o.key;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
            onPress={() => { if (!on) { haptic.tap(); onChange(o.key); } }} style={styles.switchItem}>
            {on && <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 999 }]} />}
            <T style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 15 }} color={on ? colors.onPrimary : colors.textSecondary}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Real members active recently (no fabricated profiles); "Your post" opens the composer. */
function ActiveRow() {
  const router = useRouter();
  const [people, setPeople] = useState<{ unknown_number: number; avatar_seed: string; online: boolean }[]>([]);
  useFocusEffect(useCallback(() => { getActiveStrangers(12).then(setPeople).catch(() => {}); }, []));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: spacing.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Write a post" onPress={() => router.push('/create')} style={styles.story}>
        <View style={styles.storyAdd}><Ionicons name="add" size={26} color={colors.violet} /></View>
        <T v="caption" color={colors.textSecondary}>Your post</T>
      </Pressable>
      {people.map((p) => (
        <Pressable key={p.unknown_number} accessibilityRole="button" accessibilityLabel={`UNKNOWN #${p.unknown_number}`}
          onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(p.unknown_number) } })} style={styles.story}>
          <View style={styles.storyRing}><AnonymousAvatar seed={p.avatar_seed} number={p.unknown_number} size={54} online={p.online} /></View>
          <T v="caption" color={colors.textSecondary}>#{p.unknown_number}</T>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel="See real people" onPress={() => router.push('/people')} style={styles.story}>
        <View style={styles.storyAdd}><Ionicons name="people" size={22} color={colors.violet} /></View>
        <T v="caption" color={colors.textSecondary}>People</T>
      </Pressable>
    </ScrollView>
  );
}

const HUB: { key: string; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; href: '/ai' | '/nearby' | '/people'; tint: string }[] = [
  { key: 'ai', label: 'AI Characters', sub: 'Fictional', icon: 'sparkles', href: '/ai', tint: '#FFF4C2' },
  { key: 'near', label: 'Nearby', sub: 'Opt-in', icon: 'location', href: '/nearby', tint: '#FFE8E2' },
  { key: 'world', label: 'World', sub: 'Map', icon: 'earth', href: '/people', tint: '#EAF6FF' },
];

/** Entry points to the discovery features. */
function DiscoverHub() {
  const router = useRouter();
  return (
    <View style={styles.hub}>
      {HUB.map((h) => (
        <Pressable key={h.key} accessibilityRole="button" accessibilityLabel={h.label} onPress={() => { haptic.tap(); router.push(h.href); }} style={styles.hubTile}>
          <View style={[styles.hubIcon, { backgroundColor: h.tint }]}><Ionicons name={h.icon} size={20} color={colors.text} /></View>
          <T style={{ fontFamily: fonts.bold, fontSize: 13.5 }} numberOfLines={1}>{h.label}</T>
          <T v="caption" color={colors.textMuted}>{h.sub}</T>
        </Pressable>
      ))}
    </View>
  );
}

/** AI Characters carousel — clearly labelled fictional personalities. */
function AiRow() {
  const router = useRouter();
  const { list } = useAiCharacters();
  if (!list?.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <T v="section">AI Characters</T>
        <Pressable onPress={() => router.push('/ai')} hitSlop={8}><T v="caption" color={colors.coral} style={{ fontFamily: fonts.bold }}>See all</T></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.md }}>
        {list.slice(0, 8).map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, AI ${c.role}`} onPress={() => router.push({ pathname: '/ai/[id]', params: { id: c.id } })} style={styles.aiCard}>
            <AiPortrait seed={c.avatar_seed} accent={c.accent} size={104} rounded="card" />
            <T style={{ fontFamily: fonts.bold }}>{c.name}</T>
            <T v="caption" color={colors.textMuted} numberOfLines={1}>{c.role}</T>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function Discover() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { notifications } = useBadges();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<View_>(params.view === 'match' ? 'match' : 'feed');
  useEffect(() => { if (params.view === 'match' || params.view === 'feed') setView(params.view); }, [params.view]);
  const [category, setCategory] = useState<FeedCategory>('for_you');
  const feed = usePaged<FeedPost>((offset) => getFeed(category, offset), category);

  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const compactBar = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [70, 130], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [70, 130], [-10, 0], Extrapolation.CLAMP) }],
  }));

  const topBar = (
    <View style={{ gap: spacing.md, paddingTop: insets.top + spacing.sm }}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>THE <Text style={styles.brandHi}>UNKNOWN</Text></Text>
          <T v="caption" color={colors.textSecondary}>Discover something unexpected.</T>
        </View>
        <IconButton label="Premium" name="diamond-outline" color={colors.gold} onPress={() => router.push('/premium')} />
        <IconButton label="Search" name="search" onPress={() => router.push('/search')} />
        <IconButton label="Notifications" name="notifications-outline" badge={notifications} onPress={() => router.push('/notifications')} />
      </View>
      <ViewSwitch value={view} onChange={(v) => { setView(v); router.setParams({ view: v }); }} />
    </View>
  );

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {topBar}
      <DiscoverHub />
      <AiRow />
      <ActiveRow />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {FEED_CATEGORIES.map((c) => (
          <CategoryChip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora variant={view === 'match' ? 'warm' : undefined} />
      {view === 'match' ? <MatchesView top={topBar} /> : (<>
      <Animated.FlatList
        data={feed.items}
        keyExtractor={(p) => p.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 140 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: spacing.md }}>
            <PostCard post={item} index={index} onChange={feed.update} onRemoved={feed.remove} />
          </View>
        )}
        onEndReachedThreshold={0.6}
        onEndReached={feed.loadMore}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.violet} colors={[colors.violet]} progressViewOffset={insets.top} />}
        ListEmptyComponent={
          feed.loading ? (
            <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>Discovering new stories…</T>
              <PostSkeleton /><PostSkeleton />
            </View>
          ) : feed.error ? (
            <ErrorState message={feed.error} onRetry={feed.retry} />
          ) : (
            <EmptyState icon="telescope-outline" title="Nothing here yet"
                body={category === 'my_country' ? 'Be the first voice from your country.' : 'Be the one who starts it. Someone may be waiting to discover your words.'}
                action="Write the first post" onAction={() => router.push('/create')} />
          )
        }
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.violet} style={{ margin: spacing.lg }} /> :
          feed.done && feed.items.length > 0 ? <T v="caption" color={colors.textMuted} style={{ textAlign: 'center', margin: spacing.xl }}>You reached the edge of the known. Pull to discover more.</T> : undefined}
      />
      <Animated.View pointerEvents="box-none" style={[styles.compact, { paddingTop: insets.top + 6 }, compactBar]}>
        <View style={[StyleSheet.absoluteFill, styles.compactBg]} pointerEvents="none" />
        <View style={[styles.top, { paddingBottom: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <MaskLogo size={34} />
            <T style={{ fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 3 }}>
              {FEED_CATEGORIES.find((c) => c.key === category)?.label.toUpperCase()}
            </T>
          </View>
          <IconButton label="Search" name="search" onPress={() => router.push('/search')} />
          <IconButton label="Notifications" name="notifications-outline" badge={notifications} onPress={() => router.push('/notifications')} />
        </View>
      </Animated.View>
      </>)}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md },
  compact: { position: 'absolute', left: 0, right: 0, top: 0 },
  compactBg: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border, shadowColor: '#25324A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, color: colors.text },
  brand: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.8, color: colors.text },
  brandHi: { backgroundColor: colors.primary },
  hub: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.md },
  hubTile: { flex: 1, gap: 4, padding: 12, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: '#25324A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  hubIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  aiCard: { width: 124, gap: 4, padding: 10, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  story: { alignItems: 'center', gap: 5, width: 62 },
  storyRing: { padding: 2.5, borderRadius: 40, borderWidth: 2, borderColor: colors.rose },
  storyAdd: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.surfaceBorder, borderStyle: 'dashed' },
  switch: { flexDirection: 'row', marginHorizontal: spacing.md, padding: 4, borderRadius: 999, backgroundColor: colors.blush, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#1E2540', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  switchItem: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, overflow: 'hidden' },
});
