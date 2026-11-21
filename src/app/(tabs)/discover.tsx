import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { PortalMark } from '@/components/Logo';
import { PostCard } from '@/components/PostCard';
import { BackendNotice, Screen } from '@/components/Screen';
import { CategoryChip, EmptyState, ErrorState, IconButton, PostSkeleton, T } from '@/components/ui';
import { FEED_CATEGORIES, type FeedCategory } from '@/constants/content';
import { colors, fonts, spacing } from '@/constants/theme';
import { useBadges } from '@/hooks/useBadges';
import { usePaged } from '@/hooks/usePaged';
import { getFeed } from '@/services/api';
import type { FeedPost } from '@/types/models';

export default function Discover() {
  const router = useRouter();
  const { notifications } = useBadges();
  const [category, setCategory] = useState<FeedCategory>('for_you');
  const feed = usePaged<FeedPost>((offset) => getFeed(category, offset), category);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <PortalMark size={34} spin={false} />
          <View>
            <T style={{ fontFamily: fonts.extrabold, fontSize: 15, letterSpacing: 3.2 }}>THE UNKNOWN</T>
            <T v="caption" color={colors.textMuted}>Discover something unexpected.</T>
          </View>
        </View>
        <IconButton label="Search" name="search" onPress={() => router.push('/search')} />
        <IconButton label="Notifications" name="notifications-outline" badge={notifications} onPress={() => router.push('/notifications')} />
      </View>
      <BackendNotice />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {FEED_CATEGORIES.map((c) => (
          <CategoryChip key={c.key} label={c.label} selected={category === c.key} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={feed.items}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 120 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: spacing.md }}>
            <PostCard post={item} index={index} onChange={feed.update} onRemoved={feed.remove} />
          </View>
        )}
        onEndReachedThreshold={0.6}
        onEndReached={feed.loadMore}
        refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={feed.refresh} tintColor={colors.violet} colors={[colors.violet]} />}
        ListEmptyComponent={
          feed.loading ? (
            <View style={{ paddingHorizontal: spacing.md, gap: spacing.sm }}>
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center', marginBottom: 4 }}>Discovering new stories…</T>
              <PostSkeleton /><PostSkeleton /><PostSkeleton />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});
