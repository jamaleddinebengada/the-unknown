import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { Screen } from '@/components/Screen';
import { CategoryChip, EmptyState, ErrorState, NotificationBadge, PostSkeleton, T, TextField } from '@/components/ui';
import { flagOf } from '@/constants/countries';
import { GlowRing, PulseDot, ScreenTitle } from '@/components/Effects';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getMyConversations, getMyMatches, getMyPendingInterests, setArchived } from '@/services/api';
import type { ConversationSummary, MysteryMatch } from '@/types/models';
import { timeAgo, unknownName } from '@/utils/format';

const TABS = ['All', 'Active', 'Requests', 'Connections', 'Archived'] as const;
type Tab = (typeof TABS)[number];

export default function Messages() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('All');
  const [q, setQ] = useState('');
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [matches, setMatches] = useState<MysteryMatch[]>([]);
  const [interests, setInterests] = useState<Awaited<ReturnType<typeof getMyPendingInterests>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState<ConversationSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, m, i] = await Promise.all([getMyConversations(), getMyMatches(), getMyPendingInterests()]);
      setConvs(c); setMatches(m.filter((x) => x.is_incoming && x.i_accepted === null && !x.conversation_id)); setInterests(i); setError(null);
    } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return convs.filter((c) => {
      if (tab === 'Archived' ? !c.archived : c.archived) return false;
      if (tab === 'Active' && (c.ended || Date.now() - new Date(c.last_message_at).getTime() > 7 * 864e5)) return false;
      if (tab === 'Connections' && !c.revealed) return false;
      if (!query) return true;
      return `${c.other_number ?? ''} ${c.last_body ?? ''} ${c.post_snippet ?? ''}`.toLowerCase().includes(query);
    });
  }, [convs, tab, q]);

  const requestCount = matches.length + interests.reduce((a, i) => a + i.pending, 0);

  const renderConv = ({ item, index }: { item: ConversationSummary; index: number }) => (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 35)}>
      <Pressable accessibilityRole="button" onLongPress={() => setMenuFor(item)}
        onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: item.conversation_id } })}
        style={({ pressed }) => [s.row, item.unread > 0 && s.rowUnread, pressed && { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
        {item.unread > 0 && <LinearGradient colors={['rgba(109,74,255,0.22)', 'rgba(56,189,248,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />}
        <View>
          {item.kind === 'group' ? (
            <LinearGradient colors={['rgba(109,74,255,0.5)', 'rgba(56,189,248,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.group}><Ionicons name="people" size={22} color={colors.text} /></LinearGradient>
          ) : item.unread ? (
            <GlowRing size={60} speed={3500} thickness={2}><AnonymousAvatar seed={item.other_avatar_seed ?? item.conversation_id} size={50} revealed={item.revealed} /></GlowRing>
          ) : (
            <View style={{ width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}><AnonymousAvatar seed={item.other_avatar_seed ?? item.conversation_id} size={50} revealed={item.revealed} /></View>
          )}
          {item.other_online && <View style={s.online}><PulseDot size={10} /></View>}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T v="bodyStrong" style={{ fontFamily: fonts.semibold, flex: 1 }} numberOfLines={1}>
              {item.kind === 'group' ? `Post circle · ${item.member_count}` : `${unknownName(item.other_number)} ${flagOf(item.other_country)}`}
            </T>
            <T v="caption" color={item.unread ? colors.violetSoft : colors.textMuted}>{timeAgo(item.last_message_at)}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T v="caption" color={item.unread ? colors.text : colors.textSecondary} numberOfLines={1} style={{ flex: 1, fontSize: 13.5 }}>
              {item.ended ? 'Conversation ended' : item.last_kind === 'prompt' ? `✨ ${item.last_body}` : `${item.last_is_mine ? 'You: ' : ''}${item.last_body ?? ''}`}
            </T>
            <NotificationBadge count={item.unread} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.md }}>
        <ScreenTitle overline="YOUR CONVERSATIONS" title="Messages" />
        <TextField icon="search" placeholder="Search conversations" value={q} onChangeText={setQ} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map((t) => <CategoryChip key={t} label={t === 'Requests' && requestCount ? `Requests · ${requestCount}` : t} selected={tab === t} onPress={() => setTab(t)} />)}
        </ScrollView>
      </View>

      {loading ? <View style={{ padding: spacing.md, gap: spacing.sm }}><PostSkeleton /><PostSkeleton /></View> : error ? <ErrorState message={error} onRetry={load} /> :
        tab === 'Requests' ? (
          <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.violet} />}>
            {requestCount === 0 && <EmptyState icon="mail-open-outline" title="No requests" body="When someone is interested in your post or discovers you through a Mystery Match, it appears here." />}
            {matches.map((m) => (
              <Pressable key={m.match_id} onPress={() => router.push('/matches')} style={s.request}>
                <AnonymousAvatar seed={m.other_avatar_seed} size={44} />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong">Someone discovered you</T>
                  <T v="caption" color={colors.textSecondary}>{unknownName(m.other_number)} {flagOf(m.other_country)} · {m.compatibility}% compatible</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
            {interests.map((i) => (
              <Pressable key={i.post_id} onPress={() => router.push({ pathname: '/post/[id]/interested', params: { id: i.post_id } })} style={s.request}>
                <View style={s.group}><Ionicons name="sparkles" size={20} color={colors.violetSoft} /></View>
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong">{i.pending} interested in your post</T>
                  <T v="caption" color={colors.textSecondary} numberOfLines={1}>“{i.snippet}”</T>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <FlatList data={list} keyExtractor={(c) => c.conversation_id} renderItem={renderConv}
            contentContainerStyle={{ paddingVertical: spacing.sm, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.violet} />}
            ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title={tab === 'Connections' ? 'No revealed connections yet' : 'No conversations yet'}
              body={tab === 'Connections' ? 'When you and someone both choose to reveal, they appear here.' : 'Tap “I’m Interested” on a post, or try today’s Mystery Match.'}
              action="Explore the feed" onAction={() => router.push('/discover')} />} />
        )}

      <BottomSheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        <SheetAction icon={menuFor?.archived ? 'arrow-undo-outline' : 'archive-outline'} label={menuFor?.archived ? 'Move back to inbox' : 'Archive'}
          onPress={async () => {
            const c = menuFor; setMenuFor(null);
            if (!c) return;
            try { await setArchived(c.conversation_id, !c.archived); load(); } catch (e) { toast(friendlyError(e), 'error'); }
          }} />
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 10, borderRadius: radius.lg, overflow: 'hidden' },
  rowUnread: { borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)' },
  online: { position: 'absolute', right: 5, bottom: 5, padding: 2, borderRadius: 8, backgroundColor: colors.bg },
  group: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', margin: 4 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(22,27,43,0.85)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.28)' },
});
