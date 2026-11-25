import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiPortrait } from '@/components/AiPortrait';
import { useAiCharacters } from '@/features/ai/useAiCharacters';
import { PostCard } from '@/components/PostCard';
import { CategoryChip, EmptyState, ErrorState, IconButton, PostSkeleton, T } from '@/components/ui';
import { FEED_CATEGORIES, type FeedCategory } from '@/constants/content';
import { colors, fonts, spacing } from '@/constants/theme';
import { useBadges } from '@/hooks/useBadges';
import { usePaged } from '@/hooks/usePaged';
import { discoverPeople, getFeed } from '@/services/api';
import { countryName, flagOf } from '@/constants/countries';
import { nameOf, PersonPhoto } from '@/features/people/PersonCards';
import { haptic } from '@/utils/format';
import type { FeedPost, PersonCard } from '@/types/models';


/** Horizontal row of real members (trending / new / suggested). */
function PeopleRow({ title, sort }: { title: string; sort: 'trending' | 'new' | 'suggested' }) {
  const router = useRouter();
  const [people, setPeople] = useState<PersonCard[] | null>(null);
  useFocusEffect(useCallback(() => { discoverPeople('world', 25, {}, sort, false, 0, 12).then(setPeople).catch(() => setPeople([])); }, [sort]));
  if (!people?.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <T v="section">{title}</T>
        <Pressable onPress={() => router.push('/nearby')} hitSlop={8}><T v="caption" color={colors.primary} style={{ fontFamily: fonts.bold }}>See all</T></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: spacing.md }}>
        {people.map((p) => (
          <Pressable key={p.unknown_number} accessibilityRole="button" accessibilityLabel={nameOf(p)} onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(p.unknown_number) } })} style={styles.personCard}>
            <PersonPhoto p={p} width={116} height={146} radius={14} />
            {p.online && <View style={styles.onlineDot} />}
            <Text numberOfLines={1} style={styles.personName}>{nameOf(p)}{p.age ? `, ${p.age}` : ''}</Text>
            <Text numberOfLines={1} style={styles.personPlace}>{p.country_code ? `${flagOf(p.country_code)} ${p.city ?? countryName(p.country_code)}` : 'Somewhere'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const HUB: { key: string; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; href: '/ai' | '/mystery' | '/challenges' | '/people'; tint: string; color: string }[] = [
  { key: 'mystery', label: 'Mystery', sub: 'Anonymous', icon: 'sparkles', href: '/mystery', tint: '#EAF5FF', color: '#168AF7' },
  { key: 'ai', label: 'Characters', sub: 'Virtual · AI', icon: 'happy-outline', href: '/ai', tint: '#F3EDFF', color: '#7C3AED' },
  { key: 'challenges', label: 'Challenges', sub: 'Daily XP', icon: 'trophy-outline', href: '/challenges', tint: '#FFF6DB', color: '#D49A00' },
  { key: 'world', label: 'World', sub: 'Map', icon: 'earth', href: '/people', tint: '#E9F9EF', color: '#16A34A' },
];

/** Entry points to the discovery features. */
function DiscoverHub() {
  const router = useRouter();
  return (
    <View style={styles.hub}>
      {HUB.map((h) => (
        <Pressable key={h.key} accessibilityRole="button" accessibilityLabel={h.label} onPress={() => { haptic.tap(); router.push(h.href); }} style={styles.hubTile}>
          <View style={[styles.hubIcon, { backgroundColor: h.tint }]}><Ionicons name={h.icon} size={20} color={h.color} /></View>
          <T style={{ fontFamily: fonts.semibold, fontSize: 12.5 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{h.label}</T>
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
        <View><T v="section">Virtual Characters</T><T v="caption" color={colors.textMuted}>Fictional AI-powered personalities — not real people</T></View>
        <Pressable onPress={() => router.push('/ai')} hitSlop={8}><T v="caption" color={colors.coral} style={{ fontFamily: fonts.bold }}>See all</T></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.md }}>
        {list.slice(0, 8).map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, fictional AI character, ${c.role}`} onPress={() => router.push({ pathname: '/ai/[id]', params: { id: c.id } })} style={styles.aiCard}>
            <AiPortrait seed={c.avatar_seed} accent={c.accent} size={104} rounded="card" badge={false} />
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
          <Text numberOfLines={1} style={styles.title}>Discover</Text>
        </View>
        <IconButton label="Premium" name="diamond-outline" color={colors.gold} onPress={() => router.push('/premium')} />
        <IconButton label="Search" name="search" onPress={() => router.push('/search')} />
        <IconButton label="Notifications" name="notifications-outline" badge={notifications} onPress={() => router.push('/notifications')} />
      </View>
    </View>
  );

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      {topBar}
      <DiscoverHub />
      <PeopleRow title="Trending" sort="trending" />
      <PeopleRow title="New members" sort="new" />
      <AiRow />
      <View style={styles.sectionHead}>
        <T v="section">Moments</T>
        <Pressable onPress={() => router.push('/create')} hitSlop={8} style={styles.newMoment} accessibilityRole="button" accessibilityLabel="Create a moment">
          <Ionicons name="add" size={16} color={colors.white} /><Text style={{ fontFamily: fonts.semibold, color: colors.white, fontSize: 13 }}>Post</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {FEED_CATEGORIES.map((c) => (
          <CategoryChip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
            <T style={{ fontFamily: fonts.extrabold, fontSize: 13, letterSpacing: 3 }}>
              {FEED_CATEGORIES.find((c) => c.key === category)?.label.toUpperCase()}
            </T>
          </View>
          <IconButton label="Search" name="search" onPress={() => router.push('/search')} />
          <IconButton label="Notifications" name="notifications-outline" badge={notifications} onPress={() => router.push('/notifications')} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md },
  compact: { position: 'absolute', left: 0, right: 0, top: 0 },
  compactBg: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.6, color: colors.text },
  personCard: { width: 116, gap: 3 },
  personName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.text, marginTop: 4 },
  personPlace: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  onlineDot: { position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.online, borderWidth: 2, borderColor: colors.white },
  newMoment: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: colors.primary },
  brand: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.8, color: colors.text },
  brandHi: { backgroundColor: colors.primary },
  hub: { flexDirection: 'row', gap: 10, paddingHorizontal: spacing.md },
  hubTile: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  hubIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  aiCard: { width: 124, gap: 4, padding: 10, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  story: { alignItems: 'center', gap: 5, width: 62 },
  storyRing: { padding: 2.5, borderRadius: 40, borderWidth: 2, borderColor: colors.rose },
  storyAdd: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.surfaceBorder, borderStyle: 'dashed' },
  switch: { flexDirection: 'row', marginHorizontal: spacing.md, padding: 4, borderRadius: 999, backgroundColor: colors.blush, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#1E2540', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  switchItem: { flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, overflow: 'hidden' },
});
