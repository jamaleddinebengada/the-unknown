import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { Card, EmptyState, ErrorState, GradientButton, InterestTag, PostSkeleton, PremiumButton, T } from '@/components/ui';
import { interestLabel } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getPostInterests, respondInterest } from '@/services/api';
import type { InterestedUser } from '@/types/models';
import { haptic, timeAgo, unknownName } from '@/utils/format';

export default function InterestedUsers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<InterestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [acceptFor, setAcceptFor] = useState<InterestedUser | null>(null);

  const load = useCallback(async () => {
    try { setItems(await getPostInterests(id)); setError(null); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const respond = async (u: InterestedUser, accept: boolean, group = false) => {
    setAcceptFor(null);
    setBusy(u.interest_id);
    try {
      const conv = await respondInterest(u.interest_id, accept, group);
      if (accept) haptic.success();
      setItems((p) => p.map((x) => (x.interest_id === u.interest_id ? { ...x, status: accept ? 'accepted' : 'declined', conversation_id: conv } : x)));
      if (accept && conv) {
        toast(group ? 'Added to the post’s group conversation.' : 'Conversation created.', 'success');
      }
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  const pending = items.filter((i) => i.status === 'pending').length;

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Interested" />
      {loading ? <View style={{ padding: spacing.md, gap: spacing.sm }}><PostSkeleton /><PostSkeleton /></View> : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.interest_id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}
          ListHeaderComponent={
            <View style={{ gap: 4, marginBottom: spacing.md }}>
              <T v="screenTitle">People interested in your post</T>
              <T color={colors.textSecondary}>{pending ? `${pending} waiting for your answer.` : 'Accept someone to open a private conversation.'}</T>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="sparkles-outline" title="No one yet" body="Interest often arrives quietly. We’ll notify you the moment someone reaches out." />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).springify().damping(18)} layout={LinearTransition}>
              <Card glowing={item.status === 'pending'} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <AnonymousAvatar seed={item.avatar_seed} number={item.unknown_number} size={48} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" style={{ fontFamily: fonts.semibold }}>{unknownName(item.unknown_number)}</T>
                    <T v="caption" color={colors.textMuted}>
                      {flagOf(item.country_code)} {item.country_code ? countryName(item.country_code) : 'Hidden'}{item.age_range ? ` · ${item.age_range}` : ''} · {timeAgo(item.created_at)}
                    </T>
                  </View>
                  {item.shared_interests > 0 && <InterestTag accent label={`${item.shared_interests} shared`} />}
                </View>
                {item.tagline && <T v="caption" color={colors.violetSoft}>“{item.tagline}”</T>}
                {item.intro && <T>{item.intro}</T>}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {item.interests.slice(0, 5).map((i) => <InterestTag key={i} label={interestLabel(i)} />)}
                </View>
                {item.status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <PremiumButton small tone="ghost" label="Decline" style={{ flex: 1 }} disabled={busy === item.interest_id} onPress={() => respond(item, false)} />
                    <PremiumButton small label="Profile" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(item.unknown_number) } })} />
                    <GradientButton small label="Accept" style={{ flex: 1 }} loading={busy === item.interest_id} onPress={() => setAcceptFor(item)} />
                  </View>
                ) : item.status === 'accepted' && item.conversation_id ? (
                  <GradientButton small icon="chatbubbles-outline" label="Open conversation"
                    onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: item.conversation_id! } })} />
                ) : (
                  <T v="caption" color={colors.textMuted}>{item.status === 'declined' ? 'Declined — they were not notified.' : 'Accepted'}</T>
                )}
              </Card>
            </Animated.View>
          )}
        />
      )}
      <BottomSheet visible={!!acceptFor} onClose={() => setAcceptFor(null)} title="How do you want to connect?">
        <SheetAction icon="chatbubble-outline" label="Private 1:1 conversation" onPress={() => acceptFor && respond(acceptFor, true, false)} />
        <SheetAction icon="people-outline" label="Add to this post’s group conversation" onPress={() => acceptFor && respond(acceptFor, true, true)} />
      </BottomSheet>
    </Screen>
  );
}

