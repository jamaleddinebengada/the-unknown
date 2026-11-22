import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Share, View } from 'react-native';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { PostCard } from '@/components/PostCard';
import { ReportSheet, type ReportTarget } from '@/components/SafetySheet';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, ErrorState, GradientButton, IconButton, T } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { usePaged } from '@/hooks/usePaged';
import { friendlyError } from '@/lib/supabase';
import { blockUser, connectWith, getPublicProfile, getUserPosts } from '@/services/api';
import type { FeedPost, PublicProfile } from '@/types/models';
import { haptic, unknownName } from '@/utils/format';

/** Mystery profile of another user — only public, anonymised fields. */
export default function UserProfile() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const n = Number(number);
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const posts = usePaged<FeedPost>((o) => getUserPosts(n, o), String(n));
  const [connecting, setConnecting] = useState(false);
  const connect = async () => {
    setConnecting(true);
    try {
      const m = await connectWith(n);
      haptic.success();
      if (m?.conversation_id) router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } });
      else toast(m?.they_accepted ? 'They already joined — open Messages.' : 'Request sent. When they join too, your private chat opens.', 'success');
    } catch (e) {
      toast(friendlyError(e), 'error');
      if (String((e as Error)?.message).includes('daily_limit_reached')) router.push('/premium');
    } finally { setConnecting(false); }
  };

  useEffect(() => {
    getPublicProfile(n).then((r) => { setP(r); if (!r) setError('This profile is not available.'); })
      .catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
  }, [n]);

  useEffect(() => { if (p?.is_me) router.replace('/profile'); }, [p, router]);

  const block = () => {
    setMenu(false);
    Alert.alert(`Block ${unknownName(n)}?`, 'You won’t see each other’s posts, profiles or messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => { try { await blockUser(n); toast('Blocked.', 'success'); router.back(); } catch (e) { toast(friendlyError(e), 'error'); } } },
    ]);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Profile" right={p && <IconButton label="Profile options" name="ellipsis-horizontal" onPress={() => setMenu(true)} />} />
      {loading ? <ActivityIndicator color={colors.violet} style={{ marginTop: 60 }} /> : error || !p ? <ErrorState message={error ?? ''} /> : (
        <FlatList data={posts.items} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <ProfileHeader number={p.unknown_number} seed={p.avatar_seed} country={p.country_code} age={p.age_range} interests={p.interests}
                tags={p.personality_tags} languages={p.languages} tagline={p.tagline}
                stats={[{ label: 'Posts', value: p.post_count }, { label: 'Since', value: new Date(p.member_since).getFullYear() }]} />
              <GradientButton icon="heart" label="Connect" loading={connecting} onPress={connect} />
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
                Sends a match request (counts toward your daily matches). The chat opens only if they join too.
              </T>
              <T v="section">Posts</T>
            </View>
          }
          renderItem={({ item, index }) => <PostCard post={item} index={index} onChange={posts.update} onRemoved={posts.remove} />}
          onEndReached={posts.loadMore}
          ListEmptyComponent={posts.loading ? <ActivityIndicator color={colors.violet} /> : <EmptyState icon="moon-outline" title="Quiet so far" body="They haven’t posted anything you can see yet." />} />
      )}
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <SheetAction icon="share-outline" label="Share profile" onPress={() => { setMenu(false); Share.share({ message: `${unknownName(n)} on THE UNKNOWN` }).catch(() => {}); }} />
        <SheetAction icon="flag-outline" label="Report user" onPress={() => { setMenu(false); setReportTarget({ type: 'user', number: n }); }} />
        <SheetAction icon="ban-outline" label="Block user" danger onPress={block} />
      </BottomSheet>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </Screen>
  );
}
