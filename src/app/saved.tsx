import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, ErrorState } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { usePlan } from '@/features/membership/usePlan';
import { usePaged } from '@/hooks/usePaged';
import { getSavedPosts } from '@/services/api';
import type { FeedPost } from '@/types/models';

/** Saved favorites (PLUS / VIP). */
export default function Saved() {
  const router = useRouter();
  const plan = usePlan();
  const posts = usePaged<FeedPost>((o) => getSavedPosts(o), 'saved');
  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Saved favorites" />
      {posts.error ? <ErrorState message={posts.error} onRetry={posts.retry} /> : (
        <FlatList data={posts.items} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item, index }) => <PostCard post={item} index={index} onChange={posts.update} onRemoved={posts.remove} />}
          onEndReached={posts.loadMore}
          refreshControl={<RefreshControl refreshing={posts.refreshing} onRefresh={posts.refresh} tintColor={colors.violet} />}
          ListEmptyComponent={posts.loading ? <ActivityIndicator color={colors.violet} /> : plan?.tier === 'free' ? (
            <EmptyState icon="bookmark-outline" title="Keep the posts you love" body="Saving favorites is part of UNKNOWN VIP. Tap the bookmark on any post." action="See Premium" onAction={() => router.push('/premium')} />
          ) : (
            <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Tap the bookmark on any post to keep it here." />
          )} />
      )}
    </Screen>
  );
}
