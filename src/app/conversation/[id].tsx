import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
import { aiAssist, blockUser, chatMediaUrls, endConversation, getConversation, getMessages, getReactions, markRead, REACTIONS, sendMessage, setArchived, setReaction, uploadChatMedia } from '@/services/api';
import { VoicePlayer, useVoiceRecorder } from '@/components/VoiceNote';
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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionFor, setActionFor] = useState<Message | null>(null);
  const [reactions, setReactions] = useState<Record<string, { mine?: string; counts: Record<string, number> }>>({});
  const [media, setMedia] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(false);
  const rec = useVoiceRecorder();
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTyping = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadConv = useCallback(() => getConversation(id).then(setConv), [id]);
  const loadExtras = useCallback(async (list: Message[]) => {
    const ids = list.map((m) => m.id);
    const [rx, urls] = await Promise.all([
      getReactions(ids).catch(() => []),
      chatMediaUrls(list.filter((m) => m.media_path).map((m) => m.media_path!)).catch(() => new Map<string, string>()),
    ]);
    const me = session?.user.id;
    const agg: Record<string, { mine?: string; counts: Record<string, number> }> = {};
    for (const r of rx) {
      const a = (agg[r.message_id] ??= { counts: {} });
      a.counts[r.emoji] = (a.counts[r.emoji] ?? 0) + 1;
      if (r.user_id === me) a.mine = r.emoji;
    }
    setReactions(agg);
    setMedia(urls);
  }, [session]);
  const loadMessages = useCallback(async () => {
    const list = await getMessages(id);
    setMessages(list);
    markRead(id).catch(() => {});
    loadExtras(list);
  }, [id, loadExtras]);

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
      await sendMessage(id, body, kind, undefined, kind === 'text' ? replyTo?.id : null);
      haptic.soft();
      if (kind === 'text') { setText(''); setReplyTo(null); }
      await loadMessages();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSending(false); }
  };

  const sendMedia = async (kind: 'image' | 'voice', uri: string, mime: string) => {
    setUploading(true);
    try {
      const path = await uploadChatMedia(id, uri, kind, mime);
      await sendMessage(id, kind === 'voice' ? '🎙️ Voice message' : '📷 Photo', kind, path, replyTo?.id);
      setReplyTo(null); haptic.success();
      await loadMessages();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setUploading(false); }
  };
  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) sendMedia('image', res.assets[0].uri, res.assets[0].mimeType ?? 'image/jpeg');
  };
  const toggleVoice = async () => {
    try {
      if (rec.isRecording) { const uri = await rec.stop(); if (uri) sendMedia('voice', uri, 'audio/m4a'); }
      else { await rec.start(); haptic.soft(); }
    } catch (e) { toast(friendlyError(e), 'error'); }
  };
  const react = async (m: Message, emoji: string) => {
    if (!session) return;
    const cur = reactions[m.id]?.mine;
    setActionFor(null); haptic.tap();
    try { await setReaction(m.id, session.user.id, cur === emoji ? null : emoji); loadExtras(messages); } catch (e) { toast(friendlyError(e), 'error'); }
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
            <AnonymousAvatar seed={conv.other_avatar_seed ?? id} number={isGroup ? null : conv.other_number} size={42} revealed={conv.stage >= 4} />
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
        <Pressable accessibilityRole="button" onPress={() => setReveal(true)} style={{ paddingHorizontal: spacing.md, paddingBottom: 6 }}>
          <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.banner}>
            <Ionicons name={conv.stage >= 4 ? 'lock-open' : 'lock-closed'} size={18} color={colors.onPrimary} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: fonts.bold, fontSize: 14 }} color={colors.onPrimary}>{conv.stage >= 4 ? 'Identities revealed' : 'You are both anonymous'}</T>
              <T v="caption" color="rgba(23,35,57,0.75)">{conv.stage >= 4 ? 'Tap to see what you both shared' : conv.other_reveal_consent && !conv.my_reveal_consent ? 'They want to reveal — tap to answer' : 'Reveal your identity anytime — only if you both agree'}</T>
            </View>
          </LinearGradient>
        </Pressable>
      )}
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
                  <T v="overline" color={colors.coral}>✨ MYSTERY QUESTION{mine ? '' : ` · ${unknownName(item.sender_number)}`}</T>
                  <T v="cardTitle" style={{ textAlign: 'center' }}>{item.body}</T>
                </Animated.View>
              );
            }
            return (
              <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {isGroup && !mine && <T v="caption" color={colors.textMuted} style={{ marginLeft: 6, marginBottom: 2 }}>{unknownName(item.sender_number)}</T>}
                <Pressable onLongPress={() => { haptic.soft(); setActionFor(item); }} delayLongPress={280} accessibilityHint="Long press to react, reply or report"
                  style={[st.bubble, mine ? st.mine : st.theirs]}>
                  {mine && <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 20, borderBottomRightRadius: 6 }]} />}
                  {item.reply_to && (() => {
                    const q = messages.find((x) => x.id === item.reply_to);
                    return <View style={st.quote}><T v="caption" numberOfLines={2} color={colors.textSecondary}>{q ? `${q.is_mine ? 'You' : unknownName(q.sender_number)}: ${q.body ?? ''}` : 'Earlier message'}</T></View>;
                  })()}
                  {item.kind === 'image' && item.media_path && media.get(item.media_path) ? (
                    <Image source={{ uri: media.get(item.media_path) }} style={st.photo} contentFit="cover" transition={200} accessibilityLabel="Shared photo" />
                  ) : item.kind === 'voice' && item.media_path && media.get(item.media_path) ? (
                    <VoicePlayer uri={media.get(item.media_path)!} seed={item.id} />
                  ) : <T color={colors.text}>{item.body}</T>}
                  <T v="caption" color={mine ? 'rgba(23,35,57,0.6)' : colors.textMuted} style={{ fontSize: 10.5, alignSelf: 'flex-end' }}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </T>
                </Pressable>
                {reactions[item.id] && Object.keys(reactions[item.id].counts).length > 0 && (
                  <View style={[st.reacts, mine ? { marginRight: 6 } : { marginLeft: 6 }]}>
                    {Object.entries(reactions[item.id].counts).map(([e, n]) => (
                      <Pressable key={e} onPress={() => react(item, e)} style={[st.react, reactions[item.id].mine === e && st.reactMine]}><T v="caption">{e}{n > 1 ? ` ${n}` : ''}</T></Pressable>
                    ))}
                  </View>
                )}
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
            {replyTo && (
              <View style={st.replyBar}>
                <Ionicons name="return-down-forward" size={16} color={colors.textSecondary} />
                <T v="caption" numberOfLines={1} style={{ flex: 1 }}>Replying to {replyTo.is_mine ? 'yourself' : unknownName(replyTo.sender_number)}: {replyTo.body}</T>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8} accessibilityLabel="Cancel reply"><Ionicons name="close" size={18} color={colors.textSecondary} /></Pressable>
              </View>
            )}
            <View style={st.composer}>
              <Pressable accessibilityRole="button" accessibilityLabel="Send a photo" onPress={pickImage} disabled={uploading || rec.isRecording} style={st.tool}>
                {uploading ? <ActivityIndicator size="small" color={colors.text} /> : <Ionicons name="image-outline" size={21} color={colors.text} />}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={rec.isRecording ? 'Stop and send voice message' : 'Record a voice message'} onPress={toggleVoice} disabled={uploading}
                style={[st.tool, rec.isRecording && { backgroundColor: colors.coral }]}>
                <Ionicons name={rec.isRecording ? 'stop' : 'mic-outline'} size={20} color={rec.isRecording ? colors.white : colors.text} />
              </Pressable>
              {rec.isRecording ? <T style={{ flex: 1, fontFamily: fonts.semibold }} color={colors.coral}>Recording… {rec.seconds}s — tap ■ to send</T> : (
              <TextInput value={text} onChangeText={onType} placeholder="Write something real…" placeholderTextColor={colors.textMuted}
                selectionColor={colors.primaryDeep} style={st.input} multiline maxLength={4000} accessibilityLabel="Message" />)}
              <Pressable accessibilityLabel="Send" disabled={!text.trim() || sending} onPress={() => send()} style={[st.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
                {sending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />}
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
      <BottomSheet visible={!!actionFor} onClose={() => setActionFor(null)}>
        {actionFor && (
          <View style={{ gap: 6 }}>
            <View style={st.reactBar}>
              {REACTIONS.map((e) => (
                <Pressable key={e} accessibilityLabel={`React ${e}`} onPress={() => react(actionFor, e)} style={[st.reactBig, reactions[actionFor.id]?.mine === e && st.reactMine]}><T style={{ fontSize: 26 }}>{e}</T></Pressable>
              ))}
            </View>
            {!conv.ended && <SheetAction icon="return-down-forward-outline" label="Reply" onPress={() => { setReplyTo(actionFor); setActionFor(null); }} />}
            {!actionFor.is_mine && <SheetAction icon="flag-outline" label="Report message" onPress={() => { setReportTarget({ type: 'message', targetId: actionFor.id }); setActionFor(null); }} />}
          </View>
        )}
      </BottomSheet>
      {!isGroup && <RevealSheet conv={conv} visible={reveal} onClose={() => setReveal(false)} onChanged={loadConv} />}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </Screen>
  );
}

const st = StyleSheet.create({
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primaryDeep, paddingLeft: 8, marginBottom: 6, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 6, paddingVertical: 4 },
  photo: { width: 220, height: 220, borderRadius: 14, marginBottom: 4 },
  reacts: { flexDirection: 'row', gap: 4, marginTop: -6 },
  react: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  reactMine: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDeep },
  reactBar: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  reactBig: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.md, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.cream },
  tool: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
  online: { position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.bg },
  stages: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingBottom: 8 },
  stage: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.elevated },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 2, overflow: 'hidden' },
  mine: { borderBottomRightRadius: 6, shadowColor: '#E0A800', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  theirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#172339', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  prompt: { alignSelf: 'center', width: '88%', alignItems: 'center', gap: 8, padding: spacing.md, marginVertical: 8, borderRadius: radius.lg, backgroundColor: '#FFF8DC', borderWidth: 1.5, borderColor: colors.primary, shadowColor: '#E0A800', shadowOpacity: 0.2, shadowRadius: 14, elevation: 4 },
  assist: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, minHeight: 34, justifyContent: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong },
  input: { flex: 1, maxHeight: 130, minHeight: 44, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderRadius: 22, backgroundColor: colors.card, color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  ended: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
});
