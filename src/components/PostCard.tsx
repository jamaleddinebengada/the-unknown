import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useRef, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { interestLabel, postTypeLabel } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, gradients, radius, spacing, typeAccent } from '@/constants/theme';
import { friendlyError, mediaUrl } from '@/lib/supabase';
import { blockUser, deletePost, expressInterest, setLike, withdrawInterest } from '@/services/api';
import type { FeedPost } from '@/types/models';
import { compact, haptic, timeAgo, unknownName } from '@/utils/format';
import { AnonymousAvatar } from './AnonymousAvatar';
import { GlassCard, HeartBurst } from './Effects';
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
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accent = typeAccent[post.type] ?? typeAccent.thought;
  const heart = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }));

  const open = () => !detailed && router.push({ pathname: '/post/[id]', params: { id: post.id } });

  /** Single tap opens the post; double tap likes it with a heart burst. */
  const onCardPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      setBurst((b) => b + 1);
      if (!post.liked_by_me) toggleLike();
      else haptic.soft();
      return;
    }
    lastTap.current = now;
    tapTimer.current = setTimeout(open, 280);
  };

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
      <Pressy scaleTo={detailed ? 1 : 0.985} onPress={onCardPress} accessibilityRole={detailed ? undefined : 'button'} accessibilityHint="Double tap to like">
        <GlassCard accent={accent} padding={spacing.md} radius={radius.xl} glow={!!post.my_interest || post.is_mine}>
          <View style={{ gap: spacing.sm }}>
            <View style={s.head}>
              <Pressy scaleTo={0.92} onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(post.author_number) } })} accessibilityLabel={`Open ${unknownName(post.author_number)}`}>
                <View style={[s.avatarRing, { borderColor: `${accent[0]}88` }]}>
                  <AnonymousAvatar seed={post.author_avatar_seed} size={40} />
                </View>
              </Pressy>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong" style={{ fontFamily: fonts.bold, letterSpacing: 0.6, fontSize: 14 }}>{unknownName(post.author_number)}{post.is_mine ? '  ·  You' : ''}</T>
                <T v="caption" color={colors.textMuted}>
                  {flagOf(post.author_country)} {post.author_country ? countryName(post.author_country) : 'Hidden'}
                  {post.author_age ? ` · ${post.author_age}` : ''} · {timeAgo(post.created_at)}
                </T>
              </View>
              <LinearGradient colors={[`${accent[0]}55`, `${accent[1]}22`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.typeBadge}>
                <View style={[s.typeDot, { backgroundColor: accent[1] }]} />
                <T v="caption" style={{ fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.4 }}>{postTypeLabel(post.type)}</T>
              </LinearGradient>
              <Pressy scaleTo={0.9} hitSlop={10} accessibilityLabel="More options" onPress={() => { haptic.tap(); setMenu(true); }} style={s.more}>
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
              </Pressy>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
              {(post.type === 'question' || post.type === 'debate' || post.type === 'secret') && (
                <LinearGradient colors={[accent[0], accent[1]]} style={s.quoteBar} />
              )}
              <T v={post.type === 'question' || post.type === 'debate' ? 'cardTitle' : 'body'} numberOfLines={detailed ? undefined : 8}
                style={[{ flex: 1 }, (post.type === 'question' || post.type === 'debate') ? { fontSize: 19, lineHeight: 27, fontFamily: fonts.semibold } : { fontSize: 16, lineHeight: 24 }]}>
                {post.content}
              </T>
            </View>

            {post.category && (
              <View style={{ flexDirection: 'row' }}><InterestTag label={`# ${interestLabel(post.category)}`} /></View>
            )}

            {imageUrl && <Image source={{ uri: imageUrl }} style={s.image} contentFit="cover" transition={300} accessibilityLabel="Post image" />}
            {voiceUrl && <VoicePlayer uri={voiceUrl} seed={post.id} />}

            <View style={s.divider} />
            <View style={s.actions}>
              <Pressy scaleTo={0.88} accessibilityLabel={post.liked_by_me ? 'Unlike' : 'Like'} onPress={toggleLike} style={[s.action, post.liked_by_me && s.actionOn]}>
                <Animated.View style={heartStyle}>
                  <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={19} color={post.liked_by_me ? colors.danger : colors.textSecondary} />
                </Animated.View>
                <T v="caption" color={post.liked_by_me ? colors.text : colors.textSecondary} style={{ fontFamily: fonts.semibold }}>{compact(post.like_count)}</T>
              </Pressy>
              <Pressy scaleTo={0.88} accessibilityLabel="Comments" onPress={open} style={s.action}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textSecondary} />
                <T v="caption" color={colors.textSecondary} style={{ fontFamily: fonts.semibold }}>{compact(post.comment_count)}</T>
              </Pressy>
              <Pressy scaleTo={0.88} accessibilityLabel="Share" onPress={share} style={s.action}>
                <Ionicons name="paper-plane-outline" size={18} color={colors.textSecondary} />
              </Pressy>
              <View style={{ flex: 1 }} />
              <Pressy accessibilityLabel={interestLabelText} onPress={onInterested} scaleTo={0.94}
                style={[s.interestedWrap, !(post.my_interest || post.is_mine) && { shadowColor: colors.violet, shadowOpacity: 0.6, shadowRadius: 12, elevation: 6 }]}>
                {post.my_interest || post.is_mine ? (
                  <View style={[s.interested, s.interestedOn]}>
                    <Ionicons name={post.is_mine ? 'people' : post.my_interest === 'accepted' ? 'chatbubbles' : 'checkmark-circle'} size={15} color={colors.violetSoft} />
                    <T v="caption" style={{ fontFamily: fonts.bold }} color={colors.violetSoft}>{interestLabelText}</T>
                  </View>
                ) : (
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.interested}>
                    <Ionicons name="sparkles" size={15} color={colors.text} />
                    <T v="caption" style={{ fontFamily: fonts.bold }}>{interestLabelText}</T>
                  </LinearGradient>
                )}
              </Pressy>
            </View>
          </View>
          <HeartBurst trigger={burst} />
        </GlassCard>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarRing: { padding: 2, borderRadius: 24, borderWidth: 1.5 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  more: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  quoteBar: { width: 3, borderRadius: 2 },
  image: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: colors.elevated },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.04)' },
  actionOn: { backgroundColor: 'rgba(251,113,133,0.14)' },
  interestedWrap: { borderRadius: radius.pill },
  interested: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 15, borderRadius: radius.pill },
  interestedOn: { backgroundColor: 'rgba(139,92,246,0.16)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.45)' },
});
