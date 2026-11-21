import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { interestLabel, postTypeLabel } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { friendlyError, mediaUrl } from '@/lib/supabase';
import { blockUser, deletePost, expressInterest, setLike, withdrawInterest } from '@/services/api';
import type { FeedPost } from '@/types/models';
import { compact, haptic, timeAgo, unknownName } from '@/utils/format';
import { AnonymousAvatar } from './AnonymousAvatar';
import { BottomSheet, SheetAction, useToast } from './Overlay';
import { ReportSheet, type ReportTarget } from './SafetySheet';
import { GradientButton, InterestTag, Pressy, T, TextField } from './ui';
import { VoicePlayer } from './VoiceNote';

interface Props {
  post: FeedPost;
  index?: number;
  onChange?: (p: FeedPost) => void;
  onRemoved?: (id: string) => void;
  detailed?: boolean;
}

export const PostCard = memo(function PostCard({ post, index = 0, onChange, onRemoved, detailed }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [interestSheet, setInterestSheet] = useState(false);
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));

  const open = () => !detailed && router.push({ pathname: '/post/[id]', params: { id: post.id } });

  const toggleLike = async () => {
    const liked = !post.liked_by_me;
    haptic.soft();
    if (liked) heart.value = withSequence(withSpring(1.35, { damping: 6 }), withSpring(1));
    onChange?.({ ...post, liked_by_me: liked, like_count: post.like_count + (liked ? 1 : -1) });
    try { await setLike(post.id, liked); } catch (e) {
      onChange?.(post);
      toast(friendlyError(e), 'error');
    }
  };

  const sendInterest = async () => {
    setBusy(true);
    try {
      await expressInterest(post.id, intro.trim() || undefined);
      haptic.success();
      onChange?.({ ...post, my_interest: 'pending', interested_count: post.interested_count + 1 });
      setInterestSheet(false);
      setIntro('');
      toast('Interest sent. If they accept, a private conversation opens.', 'success');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  const withdraw = async () => {
    try {
      await withdrawInterest(post.id);
      onChange?.({ ...post, my_interest: null, interested_count: Math.max(0, post.interested_count - 1) });
    } catch (e) { toast(friendlyError(e), 'error'); }
  };

  const onInterested = () => {
    if (post.is_mine) return router.push({ pathname: '/post/[id]/interested', params: { id: post.id } });
    if (post.my_interest === 'accepted') return router.push('/messages');
    if (post.my_interest === 'pending') return withdraw();
    setInterestSheet(true);
  };

  const share = () =>
    Share.share({ message: `“${post.content.slice(0, 200)}” — ${unknownName(post.author_number)} on THE UNKNOWN` }).catch(() => {});

  const confirmBlock = () => {
    setMenu(false);
    Alert.alert(`Block ${unknownName(post.author_number)}?`, 'You will no longer see each other’s posts or messages.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        try { await blockUser(post.author_number); onRemoved?.(post.id); toast('User blocked.', 'success'); } catch (e) { toast(friendlyError(e), 'error'); }
      } },
    ]);
  };

  const confirmDelete = () => {
    setMenu(false);
    Alert.alert('Delete this post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deletePost(post.id); onRemoved?.(post.id); toast('Post deleted.'); if (detailed) router.back(); } catch (e) { toast(friendlyError(e), 'error'); }
      } },
    ]);
  };

  const interestLabelText = post.is_mine
    ? `${post.interested_count} interested`
    : post.my_interest === 'accepted' ? 'Connected' : post.my_interest === 'pending' ? 'Requested' : 'I’m Interested';
  const imageUrl = mediaUrl(post.image_path);
  const voiceUrl = mediaUrl(post.voice_path);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 60).springify().damping(18)}>
      <Pressy scaleTo={detailed ? 1 : 0.99} onPress={open} accessibilityRole={detailed ? undefined : 'button'} style={s.card}>
        <View style={s.head}>
          <Pressy scaleTo={0.92} onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(post.author_number) } })} accessibilityLabel={`Open ${unknownName(post.author_number)}`}>
            <AnonymousAvatar seed={post.author_avatar_seed} size={42} />
          </Pressy>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong" style={{ fontFamily: fonts.semibold, letterSpacing: 0.3 }}>{unknownName(post.author_number)}{post.is_mine ? '  ·  You' : ''}</T>
            <T v="caption" color={colors.textMuted}>
              {flagOf(post.author_country)} {post.author_country ? countryName(post.author_country) : 'Hidden'}
              {post.author_age ? ` · ${post.author_age}` : ''} · {timeAgo(post.created_at)}
            </T>
          </View>
          <Pressy scaleTo={0.9} hitSlop={10} accessibilityLabel="More options" onPress={() => { haptic.tap(); setMenu(true); }} style={s.more}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </Pressy>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <InterestTag label={postTypeLabel(post.type)} accent />
          {post.category && <InterestTag label={interestLabel(post.category)} />}
        </View>

        <T v={post.type === 'question' || post.type === 'debate' ? 'cardTitle' : 'body'} numberOfLines={detailed ? undefined : 8}
          style={[{ marginTop: 2 }, (post.type === 'question' || post.type === 'debate') && { fontSize: 18, lineHeight: 25 }]}>
          {post.content}
        </T>

        {imageUrl && <Image source={{ uri: imageUrl }} style={s.image} contentFit="cover" transition={250} accessibilityLabel="Post image" />}
        {voiceUrl && <VoicePlayer uri={voiceUrl} seed={post.id} />}

        <View style={s.actions}>
          <Pressy scaleTo={0.9} accessibilityLabel={post.liked_by_me ? 'Unlike' : 'Like'} onPress={toggleLike} style={s.action}>
            <Animated.View style={heartStyle}>
              <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={20} color={post.liked_by_me ? colors.danger : colors.textSecondary} />
            </Animated.View>
            <T v="caption" color={colors.textSecondary}>{compact(post.like_count)}</T>
          </Pressy>
          <Pressy scaleTo={0.9} accessibilityLabel="Comments" onPress={open} style={s.action}>
            <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
            <T v="caption" color={colors.textSecondary}>{compact(post.comment_count)}</T>
          </Pressy>
          <Pressy scaleTo={0.9} accessibilityLabel="Share" onPress={share} style={s.action}>
            <Ionicons name="paper-plane-outline" size={19} color={colors.textSecondary} />
          </Pressy>
          <View style={{ flex: 1 }} />
          <Pressy accessibilityLabel={interestLabelText} onPress={onInterested}
            style={[s.interested, (post.my_interest || post.is_mine) && s.interestedOn]}>
            <Ionicons name={post.is_mine ? 'people-outline' : post.my_interest ? 'checkmark' : 'sparkles'} size={15}
              color={post.my_interest || post.is_mine ? colors.violetSoft : colors.text} />
            <T v="caption" style={{ fontFamily: fonts.semibold }} color={post.my_interest || post.is_mine ? colors.violetSoft : colors.text}>{interestLabelText}</T>
          </Pressy>
        </View>
      </Pressy>

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        {post.is_mine ? (
          <>
            <SheetAction icon="people-outline" label="People interested" onPress={() => { setMenu(false); router.push({ pathname: '/post/[id]/interested', params: { id: post.id } }); }} />
            <SheetAction icon="create-outline" label="Edit post" onPress={() => { setMenu(false); router.push({ pathname: '/create', params: { edit: post.id } }); }} />
            <SheetAction icon="trash-outline" label="Delete post" danger onPress={confirmDelete} />
          </>
        ) : (
          <>
            <SheetAction icon="person-outline" label="View mystery profile" onPress={() => { setMenu(false); router.push({ pathname: '/user/[number]', params: { number: String(post.author_number) } }); }} />
            <SheetAction icon="flag-outline" label="Report post" onPress={() => { setMenu(false); setReportTarget({ type: 'post', targetId: post.id }); }} />
            <SheetAction icon="ban-outline" label={`Block ${unknownName(post.author_number)}`} danger onPress={confirmBlock} />
          </>
        )}
      </BottomSheet>

      <BottomSheet visible={interestSheet} onClose={() => setInterestSheet(false)} title="Let them know you’re curious">
        <T color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
          Your mystery profile is shared — never your name or contact details. Add a short introduction if you like.
        </T>
        <TextField placeholder="Say something about why this resonated…" value={intro} onChangeText={setIntro} multiline maxLength={280} style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <GradientButton label="Send interest" icon="sparkles" loading={busy} onPress={sendInterest} style={{ marginTop: spacing.lg }} />
      </BottomSheet>

      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </Animated.View>
  );
});

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.hairline },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  more: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.elevated },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 8, borderRadius: radius.pill },
  interested: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.violetDeep },
  interestedOn: { backgroundColor: colors.violetTint, borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)' },
});
