import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora, GradientText } from '@/components/Effects';
import { PortalMark } from '@/components/Logo';
import { PostCard } from '@/components/PostCard';
import { CategoryChip, EmptyState, ErrorState, IconButton, PostSkeleton, T } from '@/components/ui';
import { FEED_CATEGORIES, type FeedCategory } from '@/constants/content';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBadges } from '@/hooks/useBadges';
import { usePaged } from '@/hooks/usePaged';
import { getFeed } from '@/services/api';
import type { FeedPost } from '@/types/models';
import { unknownName } from '@/utils/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? 'The night is full of strangers' : h < 12 ? 'Good morning, stranger' : h < 18 ? 'Good afternoon, stranger' : 'Good evening, stranger';
};

export default function Discover() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const titleSize = Math.min(32, (width - 32) / 11);
  const { profile } = useAuth();
  const { notifications } = useBadges();
  const [category, setCategory] = useState<FeedCategory>('for_you');
  const feed = usePaged<FeedPost>((offset) => getFeed(category, offset), category);

  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y; });
  const compactBar = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [70, 130], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [70, 130], [-10, 0], Extrapolation.CLAMP) }],
  }));
  const hero = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 110], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [-80, 0, 140], [30, 0, -40], Extrapolation.CLAMP) }, { scale: interpolate(y.value, [-80, 0], [1.08, 1], Extrapolation.CLAMP) }],
  }));

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md, paddingTop: insets.top + spacing.sm }}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <PortalMark size={36} />
          <T style={{ fontFamily: fonts.extrabold, fontSize: 14, letterSpacing: 3.4 }}>THE UNKNOWN</T>
        </View>
        <IconButton label="Search" name="search" onPress={() => router.push('/search')} />
        <IconButton label="Notifications" name="notifications-outline" badge={notifications} onPress={() => router.push('/notifications')} />
      </View>
      <Animated.View style={[{ paddingHorizontal: spacing.md, gap: 4 }, hero]}>
        <T v="overline" color={colors.violetSoft}>{greeting().toUpperCase()}</T>
        <GradientText text="Discover something" size={titleSize} width={width - 32} />
        <GradientText text="unexpected." size={titleSize} width={width - 32} colors={['#A78BFA', '#67E8F9']} />
        {profile && <T v="caption" color={colors.textMuted} style={{ marginTop: 4 }}>You are {unknownName(profile.unknown_number)} — nobody knows, unless you choose.</T>}
      </Animated.View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {FEED_CATEGORIES.map((c) => (
          <CategoryChip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora />
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
            <Animated.View entering={FadeInDown.springify()}>
              <EmptyState icon="telescope-outline" title="Nothing here yet"
                body={category === 'my_country' ? 'Be the first voice from your country.' : 'Be the one who starts it. Someone may be waiting to discover your words.'}
                action="Write the first post" onAction={() => router.push('/create')} />
            </Animated.View>
          )
        }
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.violet} style={{ margin: spacing.lg }} /> :
          feed.done && feed.items.length > 0 ? <T v="caption" color={colors.textMuted} style={{ textAlign: 'center', margin: spacing.xl }}>You reached the edge of the known. Pull to discover more.</T> : undefined}
      />
      <Animated.View pointerEvents="box-none" style={[styles.compact, { paddingTop: insets.top + 6 }, compactBar]}>
        <LinearGradient colors={['rgba(9,11,20,0.98)', 'rgba(9,11,20,0.85)', 'rgba(9,11,20,0)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[styles.top, { paddingBottom: 10 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <PortalMark size={30} spin={false} />
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
});
