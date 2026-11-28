import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { ReportSheet, type ReportTarget } from '@/components/ReportSheet';
import { IconButton } from '@/components/ui';
import { Avatar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { block, chatImageUrl, getConversation, getMessages, markRead, sendMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickPhoto } from '@/lib/media';
import { uniqueChannel } from '@/lib/realtime';
import { friendlyError } from '@/lib/supabase';
import type { Message } from '@/lib/types';
import { haptic } from '@/utils/format';

type Conv = Awaited<ReturnType<typeof getConversation>>;

/** Real-time chat (direct after a mutual match, or an activity's group chat). */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.user.id;
  const [conv, setConv] = useState<Conv | null>(null);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [menu, setMenu] = useState(false);
  const [reportT, setReportT] = useState<ReportTarget>(null);
  const list = useRef<FlatList<Message>>(null);

  const resolveImages = useCallback(async (ms: Message[]) => {
    const need = ms.filter((m) => m.media_path && !urls[m.media_path]);
    if (!need.length) return;
    const pairs = await Promise.all(need.map(async (m) => [m.media_path!, await chatImageUrl(m.media_path!)] as const));
    setUrls((u) => ({ ...u, ...Object.fromEntries(pairs.filter(([, v]) => v) as [string, string][]) }));
  }, [urls]);

  useEffect(() => {
    getConversation(id).then(setConv).catch((e) => toast(friendlyError(e), 'error'));
    getMessages(id).then((m) => { setMsgs(m); resolveImages(m); }).catch((e) => toast(friendlyError(e), 'error'));
    markRead(id);
    const ch = uniqueChannel(`wif-chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wif_messages', filter: `conversation_id=eq.${id}` }, (payload) => {
        const m = payload.new as Message;
        setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur));
        if (m.media_path) resolveImages([m]);
        markRead(id);
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const send = async (image?: { uri: string; mime: string }) => {
    if (!image && !text.trim()) return;
    setSending(true);
    try {
      const m = await sendMessage(id, image ? '' : text, image);
      setText(''); haptic.soft();
      setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur));
      if (m.media_path) resolveImages([m]);
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSending(false); }
  };
  const nameOf = (uid: string | null) => conv?.members.find((m) => m.id === uid)?.name ?? '';
  const sysText = (b: string | null) => (b === 'match' ? t('msg.matched') : b?.startsWith('joined:') ? `👋 ${b.slice(7)}` : b === 'activity_cancelled' ? '❌' : b === 'activity_created' ? '🎉' : b ?? '');
  const title = conv?.kind === 'direct' ? conv.other?.name : conv?.title ?? t('msg.group');

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.head, { paddingTop: insets.top + 6 }]}>
        <IconButton name="chevron-back" label={t('common.back')} onPress={() => router.back()} />
        <Pressable style={s.headMid} onPress={() => conv?.kind === 'direct' && conv.other ? router.push({ pathname: '/person/[id]', params: { id: conv.other.id } }) : conv?.activity_id && router.push({ pathname: '/activity/[id]', params: { id: conv.activity_id } })}>
          {conv?.kind === 'direct' ? <Avatar path={conv.other?.photo_path} name={conv.other?.name} size={38} online={conv.other?.online} /> : <View style={s.group}><Text>👥</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{title}</Text>
            {conv?.kind === 'group' && <Text style={s.sub}>{conv.members.length} · {t('msg.group')}</Text>}
          </View>
        </Pressable>
        {conv?.kind === 'direct' ? <IconButton name="ellipsis-horizontal" label="More" onPress={() => setMenu(true)} /> : <View style={{ width: 42 }} />}
      </View>
      {!msgs ? <ActivityIndicator color={colors.text} style={{ flex: 1 }} /> : (
        <FlatList ref={list} data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 14, gap: 6 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item: m, index }) => {
            if (m.kind === 'system') return <Text style={s.system}>{sysText(m.body)}</Text>;
            const mine = m.sender_id === me;
            const showName = conv?.kind === 'group' && !mine && msgs[index - 1]?.sender_id !== m.sender_id;
            return (
              <View style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {showName && <Text style={s.who}>{nameOf(m.sender_id)}</Text>}
                <View style={[s.bubble, mine ? s.mine : s.theirs, m.kind === 'image' && { padding: 4 }]}>
                  {m.kind === 'image' && m.media_path ? (urls[m.media_path] ? <Image source={{ uri: urls[m.media_path] }} style={s.img} contentFit="cover" /> : <View style={[s.img, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator /></View>) : null}
                  {!!m.body && <Text style={[s.text, mine && { color: colors.text }]}>{m.body}</Text>}
                  <Text style={s.time}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            );
          }} />
      )}
      <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
        <Pressable onPress={async () => { try { const img = await pickPhoto('library', [4, 5]); if (img) send(img); } catch (e) { toast(friendlyError(e), 'error'); } }} style={s.tool} accessibilityLabel="Photo">
          <Ionicons name="image-outline" size={22} color={colors.text} />
        </Pressable>
        <TextInput value={text} onChangeText={setText} placeholder={t('msg.placeholder')} placeholderTextColor={colors.textMuted} style={s.input} multiline maxLength={2000} accessibilityLabel={t('msg.placeholder')} />
        <Pressable onPress={() => send()} disabled={sending || !text.trim()} style={[s.send, (!text.trim() || sending) && { opacity: 0.5 }]} accessibilityLabel="Send">
          {sending ? <ActivityIndicator color={colors.text} size="small" /> : <Ionicons name="send" size={18} color={colors.text} />}
        </Pressable>
      </View>
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <SheetAction icon="flag-outline" label={t('common.report')} onPress={() => { setMenu(false); setReportT({ user: conv?.other?.id }); }} />
        <SheetAction icon="ban-outline" label={t('common.block')} danger onPress={async () => {
          setMenu(false);
          if (!conv?.other) return;
          try { await block(conv.other.id); toast(t('block.done'), 'success'); router.back(); } catch (e) { toast(friendlyError(e), 'error'); }
        }} />
      </BottomSheet>
      <ReportSheet target={reportT} onClose={() => setReportT(null)} />
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  group: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  system: { alignSelf: 'center', textAlign: 'center', fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: colors.white, borderRadius: 12, marginVertical: 6, maxWidth: '86%' },
  who: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.textMuted, marginLeft: 8, marginBottom: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, gap: 2 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 21 },
  time: { fontFamily: fonts.medium, fontSize: 10, color: 'rgba(24,32,43,0.5)', alignSelf: 'flex-end' },
  img: { width: 220, height: 275, borderRadius: 14, backgroundColor: colors.bg },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tool: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  input: { flex: 1, maxHeight: 120, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 21, backgroundColor: colors.bg, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
});
