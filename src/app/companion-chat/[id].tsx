import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { IconButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { AiError, clearCompanionChat, companionMessages, getCompanion, sendToCompanion, setCompanionMemory, type AiMessage, type Companion } from '@/features/companions/api';
import { AiBadge, Portrait, TypingBubble } from '@/features/companions/ui';
import { t, type TKey } from '@/i18n';
import { friendlyError } from '@/lib/supabase';
import { haptic } from '@/utils/format';

const ERR: Record<string, TKey> = { ai_not_configured: 'ai.notConfigured', ai_daily_limit: 'ai.limit' };

/** Chat with an AI companion. The typing indicator is shown exactly while the server generates the reply. */
export default function CompanionChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [c, setC] = useState<Companion | null>(null);
  const [msgs, setMsgs] = useState<AiMessage[] | null>(null);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const list = useRef<FlatList<AiMessage>>(null);

  useEffect(() => {
    getCompanion(id).then((x) => { if (!x.chat) { router.replace({ pathname: '/companion/[id]', params: { id } }); return; } setC(x); }).catch((e) => toast(friendlyError(e), 'error'));
    companionMessages(id).then(setMsgs).catch(() => setMsgs([]));
  }, [id, router, toast]);

  const send = async (body: string, retryOf?: string) => {
    const clean = body.trim();
    if (!clean || typing) return;
    const tmpId = retryOf ?? `tmp-${Date.now()}`;
    setText('');
    setMsgs((cur) => retryOf ? (cur ?? []).map((m) => (m.id === retryOf ? { ...m, failed: false, pending: true } : m)) : [...(cur ?? []), { id: tmpId, role: 'user', body: clean, created_at: new Date().toISOString(), pending: true }]);
    setTyping(true); haptic.soft();
    try {
      const r = await sendToCompanion(id, clean);
      setMsgs((cur) => [...(cur ?? []).map((m) => (m.id === tmpId ? { ...m, id: r.user_message_id, pending: false } : m)), { id: r.reply_id, role: 'assistant', body: r.reply, created_at: r.at }]);
    } catch (e) {
      const code = e instanceof AiError ? e.code : 'ai_failed';
      setMsgs((cur) => (cur ?? []).map((m) => (m.id === tmpId ? { ...m, pending: false, failed: true } : m)));
      if (ERR[code]) toast(t(ERR[code]), 'error'); else if (code === 'offline') toast(friendlyError(new Error('Network request failed')), 'error');
    } finally { setTyping(false); }
  };

  const toggleMemory = async () => {
    if (!c?.chat) return; setMenu(false);
    const on = !c.chat.memory_enabled;
    try { await setCompanionMemory(id, on); setC({ ...c, chat: { ...c.chat, memory_enabled: on, has_memory: on && c.chat.has_memory } }); toast(on ? t('ai.memoryOn') : t('ai.memoryOff'), 'success'); }
    catch (e) { toast(friendlyError(e), 'error'); }
  };
  const clear = () => {
    setMenu(false);
    Alert.alert(t('ai.clear'), t('ai.clearConfirm', { name: c?.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await clearCompanionChat(id); setMsgs([]); } catch (e) { toast(friendlyError(e), 'error'); } } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.head, { paddingTop: insets.top + 6 }]}>
        <IconButton name="chevron-back" label={t('common.back')} onPress={() => router.back()} />
        <Pressable style={s.headMid} onPress={() => router.push({ pathname: '/companion/[id]', params: { id } })}>
          {c ? <Portrait avatar={c.avatar} path={c.portrait_path} size={38} /> : <View style={{ width: 38 }} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.title} numberOfLines={1}>{c?.name ?? ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AiBadge full />
              {c?.chat?.memory_enabled && <Ionicons name="bookmark" size={12} color={colors.textMuted} accessibilityLabel={t('ai.memoryOn')} />}
            </View>
          </View>
        </Pressable>
        <IconButton name="ellipsis-horizontal" label="More" onPress={() => setMenu(true)} />
      </View>
      {!msgs ? <ActivityIndicator color={colors.text} style={{ flex: 1 }} /> : (
        <FlatList ref={list} data={msgs} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: 14, gap: 6, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={<View style={s.notice}><Text style={s.noticeText}>{t('ai.notice')}</Text></View>}
          ListEmptyComponent={c ? <View style={s.empty}><Portrait avatar={c.avatar} path={c.portrait_path} size={84} /><Text style={s.emptyText}>{t('ai.empty', { name: c.name })}</Text></View> : undefined}
          ListFooterComponent={typing && c ? <View style={{ marginTop: 6 }}><TypingBubble name={c.name} /></View> : undefined}
          renderItem={({ item: m }) => {
            const mine = m.role === 'user';
            return (
              <Pressable disabled={!m.failed} onPress={() => send(m.body, String(m.id))} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <View style={[s.bubble, mine ? s.mine : s.theirs, m.pending && { opacity: 0.7 }, m.failed && { borderWidth: 1, borderColor: colors.danger }]}>
                  <Text style={s.text}>{m.body}</Text>
                  <Text style={s.time}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine ? (m.pending ? ' · …' : m.failed ? '' : ' ✓') : ''}</Text>
                </View>
                {m.failed && <Text style={s.failed}>{t('ai.failed')}</Text>}
              </Pressable>
            );
          }} />
      )}
      <View style={[s.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput value={text} onChangeText={setText} placeholder={t('ai.placeholder')} placeholderTextColor={colors.textMuted} style={s.input} multiline maxLength={1000} accessibilityLabel={t('msg.placeholder')} />
        <Pressable onPress={() => send(text)} disabled={typing || !text.trim()} style={[s.send, (!text.trim() || typing) && { opacity: 0.5 }]} accessibilityLabel="Send">
          <Ionicons name="send" size={18} color={colors.text} />
        </Pressable>
      </View>
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <SheetAction icon={c?.chat?.memory_enabled ? 'bookmark' : 'bookmark-outline'} label={c?.chat?.memory_enabled ? t('ai.memoryTurnOff') : t('ai.memoryTurnOn')} onPress={toggleMemory} />
        <SheetAction icon="trash-outline" label={t('ai.clear')} danger onPress={clear} />
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  notice: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.white, marginBottom: 8, maxWidth: '92%' },
  noticeText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  emptyText: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, gap: 2 },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  text: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 21 },
  time: { fontFamily: fonts.medium, fontSize: 10, color: 'rgba(24,32,43,0.5)', alignSelf: 'flex-end' },
  failed: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.danger, marginTop: 3, marginRight: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 21, backgroundColor: colors.bg, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
});
