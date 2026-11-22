import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, ErrorState, PostSkeleton, T } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getNotifications, markAllNotificationsRead } from '@/services/api';
import type { AppNotification } from '@/types/models';
import { timeAgo } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;
const META: Record<string, { icon: IconName; color: string; text: string }> = {
  like: { icon: 'heart', color: colors.danger, text: 'Someone liked your post.' },
  comment: { icon: 'chatbubble', color: colors.blue, text: 'Someone replied to your post.' },
  interested: { icon: 'sparkles', color: colors.violetSoft, text: 'Someone is interested in your post.' },
  interest_accepted: { icon: 'checkmark-circle', color: colors.success, text: 'Your interest was accepted — a conversation is open.' },
  match: { icon: 'planet', color: colors.cyan, text: 'You received a Mystery Match.' },
  super_connect: { icon: 'star', color: colors.gold, text: 'A VIP sent you a Super Connect ⭐' },
  match_accepted: { icon: 'planet', color: colors.success, text: 'Your Mystery Match wants to discover you too.' },
  message: { icon: 'chatbubbles', color: colors.violetSoft, text: 'New message.' },
  reveal_request: { icon: 'eye', color: colors.cyan, text: 'Someone wants to reveal their identity.' },
  revealed: { icon: 'eye', color: colors.success, text: 'Identities revealed. You’re connected.' },
  trending: { icon: 'trending-up', color: colors.warning, text: 'Your post is trending.' },
};

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await getNotifications()); setError(null); markAllNotificationsRead().catch(() => {}); }
    catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (n: AppNotification) => {
    const d = n.data;
    if (d.conversation_id) router.push({ pathname: '/conversation/[id]', params: { id: d.conversation_id } });
    else if (n.type === 'interested' && d.post_id) router.push({ pathname: '/post/[id]/interested', params: { id: d.post_id } });
    else if (d.post_id) router.push({ pathname: '/post/[id]', params: { id: d.post_id } });
    else if (n.type === 'match' || n.type === 'super_connect') router.navigate({ pathname: '/discover', params: { view: 'match' } });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Notifications" />
      {loading ? <View style={{ padding: spacing.md, gap: 8 }}><PostSkeleton /></View> : error ? <ErrorState message={error} onRetry={load} /> : (
        <FlatList data={items} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: spacing.md, gap: 8 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="All quiet" body="When the unknown reaches out, you’ll see it here." />}
          renderItem={({ item, index }) => {
            const m = META[item.type] ?? { icon: 'ellipse' as IconName, color: colors.textSecondary, text: 'Something happened.' };
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 30)}>
                <Pressable onPress={() => open(item)} style={[s.row, !item.read_at && s.unread]}>
                  <View style={[s.icon, { backgroundColor: `${m.color}22` }]}><Ionicons name={m.icon} size={18} color={m.color} /></View>
                  <T style={{ flex: 1 }}>{m.text}</T>
                  <T v="caption" color={colors.textMuted}>{timeAgo(item.created_at)}</T>
                </Pressable>
              </Animated.View>
            );
          }} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.card },
  unread: { borderWidth: 1, borderColor: 'rgba(163,40,142,0.35)' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
