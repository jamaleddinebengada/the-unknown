import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { ReportSheet, type ReportTarget } from '@/components/SafetySheet';
import { Screen } from '@/components/Screen';
import { ErrorState, IconButton, T } from '@/components/ui';
import { MYSTERY_QUESTIONS } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, gradients, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { RevealSheet } from '@/features/chat/RevealSheet';
import { uniqueChannel } from '@/lib/realtime';
import { friendlyError, supabase } from '@/lib/supabase';
import { aiAssist, blockUser, endConversation, getConversation, getMessages, markRead, sendMessage, setArchived } from '@/services/api';
import type { ConversationDetail, Message } from '@/types/models';
import { haptic, unknownName } from '@/utils/format';

const STAGES = ['Anonymous', 'Interests discovered', 'Voice exchanged', 'Identity revealed', 'Connection established'];

function Dot({ i }: { i: number }) {
  const d = useSharedValue(0.3);
  useEffect(() => { d.value = withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0.3, { duration: 300 })), -1)); }, [d, i]);
  const a = useAnimatedStyle(() => ({ opacity: d.value, transform: [{ translateY: -3 * d.value }] }));
  return <Animated.View style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textSecondary }, a]} />;
}

function TypingDots() {
  return (
    <View style={[st.bubble, st.theirs, { flexDirection: 'row', gap: 4, paddingVertical: 14 }]}>
      <Dot i={0} /><Dot i={1} /><Dot i={2} />
    </View>
  );
}

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { session } = useAuth();
  const [conv, setConv] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConv = useCallback(() => getConversation(id).then(setConv), [id]);
  const loadMessages = useCallback(async () => { setMessages(await getMessages(id)); markRead(id).catch(() => {}); }, [id]);

  useEffect(() => {
    Promise.all([loadConv(), loadMessages()]).catch((e) => setError(friendlyError(e))).finally(() => setLoading(false));
  }, [loadConv, loadMessages]);

  // realtime: new messages (RLS-filtered), typing broadcast and presence
  useEffect(() => {
    if (!session) return;
    const ch = uniqueChannel(`conv:${id}`, { config: { presence: { key: session.user.id }, broadcast: { self: false } } });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, () => {
      setTyping(false);
      loadMessages().catch(() => {});
      loadConv().catch(() => {});
    })
      .on('broadcast', { event: 'typing' }, () => {
        setTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3500);
      })
      .on('presence', { event: 'sync' }, () => setOnline(Object.keys(ch.presenceState()).some((k) => k !== session.user.id)))
      .subscribe((status) => { if (status === 'SUBSCRIBED') ch.track({ at: Date.now() }).catch(() => {}); });
    channel.current = ch;
    return () => { supabase.removeChannel(ch); channel.current = null; };
  }, [id, session, loadMessages, loadConv]);

  const onType = (t: string) => {
    setText(t);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      channel.current?.send({ type: 'broadcast', event: 'typing', payload: {} }).catch(() => {});
    }
  };

  const send = async (body = text.trim(), kind: 'text' | 'prompt' = 'text') => {
    if (!body) return;
    setSending(true);
    try {
      await sendMessage(id, body, kind);
      haptic.soft();
      if (kind === 'text') setText('');
      await loadMessages();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSending(false); }
  };

  const mysteryQuestion = () => send(MYSTERY_QUESTIONS[Math.floor(Math.random() * MYSTERY_QUESTIONS.length)], 'prompt');

  const suggest = async () => {
    setSuggesting(true);
    try {
      const recent = messages.slice(0, 12).reverse().filter((m) => m.kind !== 'system').map((m) => `${m.is_mine ? 'Me' : 'Them'}: ${m.body}`).join('\n');
      setText(await aiAssist('conversation', recent || 'We just connected.'));
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSuggesting(false); }
  };

  const confirm = (title: string, body: string, action: string, fn: () => Promise<void>) => {
    setMenu(false);
    Alert.alert(title, body, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: () => fn().catch((e) => toast(friendlyError(e), 'error')) }]);
  };

  if (loading) return <Screen><ActivityIndicator color={colors.violet} style={{ marginTop: 80 }} /><T v="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: 12 }}>Connecting…</T></Screen>;
  if (error || !conv) return <Screen><ErrorState message={error ?? 'Conversation not found.'} onRetry={() => router.back()} /></Screen>;

  const isGroup = conv.kind === 'group';
  const title = isGroup ? 'Post circle' : unknownName(conv.other_number);
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={st.header}>
        <IconButton label="Back" name="chevron-back" onPress={() => router.back()} />
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }} accessibilityRole="button"
          onPress={() => !isGroup && conv.other_number && router.push({ pathname: '/user/[number]', params: { number: String(conv.other_number) } })}>
          <View>
            <AnonymousAvatar seed={conv.other_avatar_seed ?? id} size={38} revealed={conv.stage >= 4} />
            {online && <View style={st.online} />}
          </View>
          <View style={{ flex: 1 }}>
            <T v="bodyStrong" style={{ fontFamily: fonts.semibold }} numberOfLines={1}>{title}</T>
            <T v="caption" color={typing ? colors.violetSoft : colors.textMuted} numberOfLines={1}>
              {typing ? 'typing…' : online ? 'Online now' : isGroup ? 'Group conversation' : `${flagOf(conv.other_country)} ${conv.other_country ? countryName(conv.other_country) : ''}`}
            </T>
          </View>
        </Pressable>
        {!isGroup && <IconButton label="Reveal identity" name={conv.stage >= 4 ? 'eye' : 'eye-outline'} color={conv.other_reveal_consent && !conv.my_reveal_consent ? colors.cyan : colors.text} onPress={() => setReveal(true)} />}
        <IconButton label="Conversation options" name="ellipsis-horizontal" onPress={() => setMenu(true)} />
      </View>

      {!isGroup && (
        <View style={st.stages}>
          {STAGES.map((s, i) => <View key={s} style={[st.stage, i < conv.stage && { backgroundColor: i < 3 ? colors.violet : colors.cyan }]} />)}
          <T v="caption" color={colors.textMuted} style={{ marginLeft: 8 }}>{STAGES[conv.stage - 1]}</T>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: 6 }}
          ListHeaderComponent={typing ? <TypingDots /> : undefined}
          onEndReachedThreshold={0.3}
          onEndReached={async () => {
            const oldest = messages[messages.length - 1];
            if (!oldest || messages.length < 50) return;
            const older = await getMessages(id, oldest.created_at).catch(() => []);
            setMessages((p) => [...p, ...older.filter((o) => !p.some((x) => x.id === o.id))]);
          }}
          renderItem={({ item }) => {
            if (item.kind === 'system') return <T v="caption" color={colors.textMuted} style={{ textAlign: 'center', marginVertical: 10, paddingHorizontal: spacing.xl }}>{item.body}</T>;
            const mine = !!item.is_mine;
            if (item.kind === 'prompt') {
              return (
                <Animated.View entering={FadeInUp} style={st.prompt}>
                  <T v="overline" color={colors.cyan}>✨ MYSTERY QUESTION{mine ? '' : ` · ${unknownName(item.sender_number)}`}</T>
                  <T v="cardTitle" style={{ textAlign: 'center' }}>{item.body}</T>
                </Animated.View>
              );
            }
            return (
              <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {isGroup && !mine && <T v="caption" color={colors.textMuted} style={{ marginLeft: 6, marginBottom: 2 }}>{unknownName(item.sender_number)}</T>}
                <Pressable onLongPress={() => !mine && setReportTarget({ type: 'message', targetId: item.id })} accessibilityHint={mine ? undefined : 'Long press to report'}
                  style={[st.bubble, mine ? st.mine : st.theirs]}>
                  {mine && <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 20, borderBottomRightRadius: 6 }]} />}
                  <T>{item.body}</T>
                  <T v="caption" color={mine ? 'rgba(248,250,252,0.65)' : colors.textMuted} style={{ fontSize: 10.5, alignSelf: 'flex-end' }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </T>
                </Pressable>
              </Animated.View>
            );
          }}
        />

        {conv.ended ? (
          <View style={st.ended}><Ionicons name="moon-outline" size={16} color={colors.textMuted} /><T v="caption" color={colors.textMuted}>This conversation has ended.</T></View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: spacing.md, paddingBottom: 8 }}>
              <Pressable accessibilityRole="button" onPress={mysteryQuestion} style={st.assist}>
                <T v="caption" color={colors.violetSoft} style={{ fontFamily: fonts.semibold }}>✨ Ask a Mystery Question</T>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={suggest} disabled={suggesting} style={st.assist}>
                {suggesting ? <ActivityIndicator size="small" color={colors.cyan} /> : <T v="caption" color={colors.cyan} style={{ fontFamily: fonts.semibold }}>What should I ask?</T>}
              </Pressable>
            </View>
            <View style={st.composer}>
              <TextInput value={text} onChangeText={onType} placeholder="Write something real…" placeholderTextColor={colors.textMuted}
                selectionColor={colors.violet} style={st.input} multiline maxLength={4000} accessibilityLabel="Message" />
              <Pressable accessibilityLabel="Send" disabled={!text.trim() || sending} onPress={() => send()} style={[st.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
                {sending ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="arrow-up" size={20} color={colors.text} />}
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>

      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        {!isGroup && <SheetAction icon="eye-outline" label="Reveal identity" onPress={() => { setMenu(false); setReveal(true); }} />}
        <SheetAction icon="archive-outline" label="Archive conversation" onPress={async () => { setMenu(false); await setArchived(id, true).catch(() => {}); toast('Archived.'); router.back(); }} />
        {!isGroup && conv.other_number && <SheetAction icon="flag-outline" label="Report user" onPress={() => { setMenu(false); setReportTarget({ type: 'user', number: conv.other_number! }); }} />}
        {!conv.ended && <SheetAction icon="exit-outline" label="End conversation" danger onPress={() => confirm('End this conversation?', 'Neither of you will be able to send new messages.', 'End', async () => { await endConversation(id); await loadConv(); await loadMessages(); })} />}
        {!isGroup && conv.other_number && <SheetAction icon="ban-outline" label="Block user" danger onPress={() => confirm(`Block ${unknownName(conv.other_number)}?`, 'The conversation ends and you won’t see each other again.', 'Block', async () => { await blockUser(conv.other_number!); toast('Blocked.', 'success'); router.back(); })} />}
      </BottomSheet>
      {!isGroup && <RevealSheet conv={conv} visible={reveal} onClose={() => setReveal(false)} onChanged={loadConv} />}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </Screen>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
  online: { position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.bg },
  stages: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingBottom: 8 },
  stage: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.elevated },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 2, overflow: 'hidden' },
  mine: { borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.card, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.hairline },
  prompt: { alignSelf: 'center', width: '88%', alignItems: 'center', gap: 8, padding: spacing.md, marginVertical: 8, borderRadius: radius.lg, backgroundColor: '#14152B', borderWidth: 1, borderColor: 'rgba(103,232,249,0.25)' },
  assist: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, minHeight: 34, justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  input: { flex: 1, maxHeight: 130, minHeight: 44, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: colors.card, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.violetDeep, alignItems: 'center', justifyContent: 'center' },
  ended: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
