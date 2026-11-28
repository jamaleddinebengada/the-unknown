import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t, type TKey } from '@/i18n';
import { getNotifications, markNotificationsRead } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Notification } from '@/lib/types';
import { timeAgo } from '@/utils/format';

const ICON: Record<string, string> = { request: '👋', match: '🎉', join_request: '🙋', join_approved: '✅', join_declined: '🚫', activity_cancelled: '❌' };

export default function Notifications() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [items, setItems] = useState<Notification[] | null>(null);
  useFocusEffect(useCallback(() => {
    getNotifications().then(setItems).catch(() => setItems([]));
    markNotificationsRead().then(() => refresh()).catch(() => {});
  }, [refresh]));
  const open = (n: Notification) => {
    const d = n.data;
    if (d.conversation_id) router.push({ pathname: '/chat/[id]', params: { id: d.conversation_id } });
    else if (d.activity) router.push({ pathname: '/activity/[id]', params: { id: d.activity } });
    else if (n.type === 'request') router.push('/(tabs)/messages');
    else if (d.user) router.push({ pathname: '/person/[id]', params: { id: d.user } });
  };
  return (
    <Screen>
      <StackHeader title={t('notif.title')} />
      <FlatList data={items ?? []} keyExtractor={(n) => n.id} contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={items === null ? <ActivityIndicator color={colors.text} /> : <EmptyState icon="notifications-outline" title={t('notif.empty')} />}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={[s.row, !n.read_at && { backgroundColor: colors.primarySoft }]}>
            <Text style={{ fontSize: 24 }}>{ICON[n.type] ?? '🔔'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{t(`notif.${n.type}` as TKey, { name: n.data.name ?? '', title: n.data.title ?? '' })}</Text>
              <Text style={s.time}>{timeAgo(n.created_at)}</Text>
            </View>
          </Pressable>
        )} />
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: colors.white },
  text: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
});
