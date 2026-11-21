import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { useToast } from '@/components/Overlay';
import { PostCard } from '@/components/PostCard';
import { ReportSheet, type ReportTarget } from '@/components/SafetySheet';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, ErrorState, GradientButton, PostSkeleton, T } from '@/components/ui';
import { flagOf } from '@/constants/countries';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { addComment, deleteComment, getComments, getPost } from '@/services/api';
import type { Comment, FeedPost } from '@/types/models';
import { haptic, timeAgo, unknownName } from '@/utils/format';

export default function PostDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getPost(id), getComments(id)]);
      setPost(p); setComments(c); setError(p ? null : 'This post is no longer available.');
    } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !post) return;
    setSending(true);
    try {
      await addComment(post.id, body);
      haptic.soft();
      setText('');
      setPost({ ...post, comment_count: post.comment_count + 1 });
      setComments(await getComments(post.id));
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSending(false); }
  };

  const remove = async (c: Comment) => {
    try {
      await deleteComment(c.id);
      setComments((p) => p.filter((x) => x.id !== c.id));
      if (post) setPost({ ...post, comment_count: Math.max(0, post.comment_count - 1) });
    } catch (e) { toast(friendlyError(e), 'error'); }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Post" />
      {loading ? <View style={{ padding: spacing.md }}><PostSkeleton /></View> : error || !post ? (
        <ErrorState message={error ?? 'Not found'} onRetry={load} />
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl }}
            ListHeaderComponent={
              <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
                <PostCard post={post} detailed onChange={setPost} onRemoved={() => router.back()} />
                {post.is_mine && (
                  <GradientButton icon="people-outline" label={`See who’s interested (${post.interested_count})`}
                    onPress={() => router.push({ pathname: '/post/[id]/interested', params: { id: post.id } })} />
                )}
                <T v="overline" color={colors.textMuted}>{post.comment_count} {post.comment_count === 1 ? 'REPLY' : 'REPLIES'}</T>
              </View>
            }
            ListEmptyComponent={<EmptyState icon="chatbubble-ellipses-outline" title="No replies yet" body="Your words might be the ones they needed." />}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40)} style={s.comment}>
                <AnonymousAvatar seed={item.author_avatar_seed} size={32} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="caption" color={colors.textSecondary} style={{ fontFamily: fonts.semibold }}>
                    {unknownName(item.author_number)} {flagOf(item.author_country)} · {timeAgo(item.created_at)}{item.is_mine ? ' · You' : ''}
                  </T>
                  <T>{item.content}</T>
                </View>
                {item.can_delete ? (
                  <Pressable accessibilityLabel="Delete reply" hitSlop={10} onPress={() => remove(item)}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : (
                  <Pressable accessibilityLabel="Report reply" hitSlop={10} onPress={() => setReportTarget({ type: 'comment', targetId: item.id })}>
                    <Ionicons name="flag-outline" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
              </Animated.View>
            )}
          />
          <View style={s.composer}>
            <TextInput value={text} onChangeText={setText} placeholder="Reply anonymously…" placeholderTextColor={colors.textMuted}
              selectionColor={colors.violet} style={s.input} multiline maxLength={800} accessibilityLabel="Reply" />
            <Pressable accessibilityLabel="Send reply" disabled={!text.trim() || sending} onPress={send}
              style={[s.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
              {sending ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="arrow-up" size={20} color={colors.text} />}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  comment: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.bgSecondary },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: colors.card, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.violetDeep, alignItems: 'center', justifyContent: 'center' },
});
