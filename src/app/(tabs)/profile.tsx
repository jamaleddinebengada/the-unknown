import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, RefreshControl, Share, View } from 'react-native';
import { ScreenTitle } from '@/components/Effects';
import { PostCard } from '@/components/PostCard';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, IconButton, PremiumButton, T } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { usePaged } from '@/hooks/usePaged';
import { getUserPosts } from '@/services/api';
import type { FeedPost } from '@/types/models';
import { ageFromDate, unknownName } from '@/utils/format';

export default function MyProfile() {
  const router = useRouter();
  const { profile, refreshProfile, session, resetIdentity } = useAuth();
  const resetIfNeeded = () => (session ? refreshProfile() : resetIdentity());
  const n = profile?.unknown_number ?? 0;
  const posts = usePaged<FeedPost>((o) => getUserPosts(n, o), String(n));
  if (!profile) return <Screen><ErrorState message="Your anonymous identity is still connecting." onRetry={() => { resetIfNeeded(); }} /></Screen>;

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><ScreenTitle overline="YOUR MYSTERY PROFILE" title="Profile" /></View>
        <IconButton label="Share profile" name="share-outline" onPress={() => Share.share({ message: `Find me on THE UNKNOWN as ${unknownName(n)}` }).catch(() => {})} />
        <IconButton label="Settings" name="settings-outline" onPress={() => router.push('/settings')} />
      </View>
      <ProfileHeader number={n} seed={profile.avatar_seed} country={profile.country_code}
        age={profile.birth_date ? String(ageFromDate(profile.birth_date)) : null} interests={profile.interests} tags={profile.personality_tags}
        languages={profile.languages} tagline={profile.tagline} premium={profile.is_premium}
        stats={[{ label: 'Posts', value: posts.items.length + (posts.done ? '' : '+') }, { label: 'Member since', value: new Date(profile.created_at).getFullYear() }]} />
      <PremiumButton icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
      <T v="overline" color={colors.textMuted} style={{ marginTop: spacing.sm }}>YOUR POSTS</T>
    </View>
  );

  return (
    <Screen>
      <FlatList data={posts.items} keyExtractor={(p) => p.id} ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 130 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item, index }) => <PostCard post={item} index={index} onChange={posts.update} onRemoved={posts.remove} />}
        onEndReached={posts.loadMore}
        refreshControl={<RefreshControl refreshing={posts.refreshing} onRefresh={() => { refreshProfile(); posts.refresh(); }} tintColor={colors.violet} />}
        ListEmptyComponent={posts.loading ? <ActivityIndicator color={colors.violet} /> :
          <EmptyState icon="create-outline" title="Your story starts here" body="Share a thought, a question or a secret. Someone, somewhere, may be waiting for it." action="Create a post" onAction={() => router.push('/create')} />} />
    </Screen>
  );
}
