import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { EmptyState } from '@/components/ui';
import { Avatar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { getInbox, respondRequest } from '@/lib/api';
import { companionInbox, type AiThread } from '@/features/companions/api';
import { AiBadge, Portrait } from '@/features/companions/ui';
import { friendlyError } from '@/lib/supabase';
import type { Conversation, Inbox } from '@/lib/types';

type Row = { k: 'conv'; c: Conversation; at: string } | { k: 'ai'; a: AiThread; at: string };
import { haptic, timeAgo } from '@/utils/format';

const preview = (b: string | null | undefined, kind?: string) => (kind === 'image' ? '📷' : kind === 'system' ? (b === 'match' ? '🎉' : '•') : b ?? '');

/** Requests (accept / decline) and conversations — chat only opens after mutual acceptance. */
export default function Messages() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [ai, setAi] = useState<AiThread[]>([]);
  const load = useCallback(() => Promise.all([
    getInbox().then(setInbox).catch((e) => toast(friendlyError(e), 'error')),
    companionInbox().then(setAi).catch(() => setAi([])),
  ]), [toast]);
  const rows: Row[] = [...(inbox?.conversations ?? []).map((c) => ({ k: 'conv' as const, c, at: c.last_at })), ...ai.map((a) => ({ k: 'ai' as const, a, at: a.last_at }))]
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''));
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    try {
      const r = await respondRequest(id, accept);
      haptic.success();
      if (accept && r.conversation_id) router.push({ pathname: '/chat/[id]', params: { id: r.conversation_id } });
      load();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 10 }}>
      <Text style={s.title}>{t('msg.title')}</Text>
      {!inbox ? <ActivityIndicator color={colors.text} style={{ marginTop: 40 }} /> : (
        <FlatList data={rows} keyExtractor={(r) => (r.k === 'ai' ? `ai-${r.a.id}` : r.c.id)} contentContainerStyle={{ paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListHeaderComponent={inbox.requests.length ? (
            <View style={{ paddingHorizontal: 20, gap: 10, marginBottom: 14 }}>
              <Text style={s.section}>{t('msg.requests')} · {inbox.requests.length}</Text>
              {inbox.requests.map((r) => (
                <View key={r.id} style={s.req}>
                  <Pressable onPress={() => router.push({ pathname: '/person/[id]', params: { id: r.person.id } })} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 }}>
                    <Avatar path={r.person.photo_path} name={r.person.name} size={50} online={r.person.online} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{r.person.name}{r.person.age ? `, ${r.person.age}` : ''}</Text>
                      <Text style={s.prev} numberOfLines={2}>{r.message ?? r.person.city ?? ''}</Text>
                    </View>
                  </Pressable>
                  <View style={{ gap: 6 }}>
                    <Pressable onPress={() => respond(r.id, true)} disabled={busy === r.id} style={[s.btn, { backgroundColor: colors.primary }]}><Text style={s.btnText}>{t('msg.accept')}</Text></Pressable>
                    <Pressable onPress={() => respond(r.id, false)} disabled={busy === r.id} style={s.btn}><Text style={[s.btnText, { color: colors.textMuted }]}>{t('msg.decline')}</Text></Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : undefined}
          ListEmptyComponent={inbox.requests.length ? undefined : <EmptyState icon="chatbubbles-outline" title={t('msg.empty')} body={t('msg.emptyBody')} />}
          renderItem={({ item: r }) => r.k === 'ai' ? (
            <Pressable onPress={() => router.push({ pathname: '/companion-chat/[id]', params: { id: r.a.id } })} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.white }]}>
              <Portrait avatar={r.a.avatar} path={r.a.portrait_path} size={54} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}><Text style={s.name} numberOfLines={1}>{r.a.name}</Text><AiBadge /></View>
                  <Text style={s.time}>{timeAgo(r.a.last_at)}</Text>
                </View>
                <Text style={s.prev} numberOfLines={1}>{r.a.last ? `${r.a.last.role === 'user' ? '✓ ' : ''}${r.a.last.body}` : r.a.occupation}</Text>
              </View>
            </Pressable>
          ) : ((c) => (
            <Pressable onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.white }]}>
              {c.kind === 'direct' ? <Avatar path={c.other?.photo_path} name={c.other?.name} size={54} online={c.other?.online} /> : <View style={s.groupIcon}><Text style={{ fontSize: 24 }}>👥</Text></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.name} numberOfLines={1}>{c.kind === 'direct' ? c.other?.name : c.title ?? t('msg.group')}</Text>
                  <Text style={s.time}>{timeAgo(c.last_at)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.prev, c.unread > 0 && { color: colors.text, fontFamily: fonts.semibold }]} numberOfLines={1}>{c.last?.mine ? '✓ ' : ''}{preview(c.last?.body, c.last?.kind)}</Text>
                  {c.unread > 0 && <View style={s.unread}><Text style={s.unreadText}>{c.unread}</Text></View>}
                </View>
              </View>
            </Pressable>
          ))(r.c)} />
      )}
    </View>
  );
}
const s = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, paddingHorizontal: 20, marginBottom: 12, letterSpacing: -0.6 },
  section: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  req: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, alignItems: 'center', backgroundColor: colors.bg },
  btnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  groupIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text, flexShrink: 1 },
  prev: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  time: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  unread: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  unreadText: { fontFamily: fonts.bold, fontSize: 11, color: colors.text },
});
