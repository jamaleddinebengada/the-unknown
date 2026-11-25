import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AiBadge, AiPortrait } from '@/components/AiPortrait';
import { useToast } from '@/components/Overlay';
import { Screen } from '@/components/Screen';
import { ErrorState, IconButton, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAiCharacters } from '@/features/ai/useAiCharacters';
import { friendlyError } from '@/lib/supabase';
import { deleteAiConversation, getAiMessages, getAiQuota, sendAiMessage, type AiMessage } from '@/services/api';
import { haptic } from '@/utils/format';

function Dot({ i }: { i: number }) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!reduce) t.set(withDelay(i * 160, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1)));
  }, [t, i, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: 0.35 + t.value * 0.65, transform: [{ translateY: -3 * t.value }] }));
  return <Animated.View style={[s.dot, a]} />;
}

/** Chat with a fictional AI character. Replies come only from the server-side model — never invented. */
export default function AiChat() {
  const { id, starter } = useLocalSearchParams<{ id: string; starter?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { list } = useAiCharacters();
  const c = list?.find((x) => x.id === id);
  const [messages, setMessages] = useState<AiMessage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState(starter ?? '');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<{ text: string; error: string } | null>(null);
  const [outgoing, setOutgoing] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ used: number; msg_limit: number } | null>(null);
  const listRef = useRef<FlatList<AiMessage>>(null);

  const load = useCallback(async () => {
    try { setMessages(await getAiMessages(id!)); setLoadError(null); } catch (e) { setLoadError(friendlyError(e)); }
    getAiQuota().then(setQuota).catch(() => {});
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const send = async (body = text.trim()) => {
    if (!body || sending) return;
    setSending(true); setFailed(null); setText(''); setOutgoing(body); haptic.tap();
    try {
      const rows = await sendAiMessage(id!, body);
      setMessages((m) => [...(m ?? []), ...rows]);
      setQuota((q) => (q ? { ...q, used: q.used + 1 } : q));
    } catch (e) {
      setFailed({ text: body, error: friendlyError(e) });
    } finally { setSending(false); setOutgoing(null); }
  };

  const remove = () => Alert.alert('Delete this conversation?', `Your messages with ${c?.name ?? 'this character'} will be permanently deleted.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deleteAiConversation(id!); setMessages([]); toast('Conversation deleted', 'success'); } catch (e) { toast(friendlyError(e), 'error'); }
    } },
  ]);

  const data = [...(messages ?? [])];

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.header}>
        <IconButton label="Back" name="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/ai'))} />
        {c && <Pressable onPress={() => router.push({ pathname: '/ai/[id]', params: { id: c.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <AiPortrait seed={c.avatar_seed} accent={c.accent} size={42} badge={false} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={s.name}>{c.name}</Text><AiBadge small /></View>
            <T v="caption" color={colors.textMuted}>{sending ? "typing…" : `Fictional AI character · ${c.role}`}</T>
          </View>
        </Pressable>}
        <IconButton label="Delete conversation" name="trash-outline" onPress={remove} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loadError ? <ErrorState message={loadError} onRetry={load} /> : !messages ? <ActivityIndicator color={colors.primaryDeep} style={{ marginTop: 60 }} /> : (
          <FlatList ref={listRef} data={data} keyExtractor={(m) => m.id}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ padding: spacing.md, gap: 10, flexGrow: 1 }}
            ListEmptyComponent={c ? (
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 30 }}>
                <AiPortrait seed={c.avatar_seed} accent={c.accent} size={110} />
                <T style={{ fontFamily: fonts.bold }}>Say hi to {c.name}</T>
                <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>{c.name} is a fictional AI. Don’t share private details like your address, phone or passwords.</T>
                <View style={{ gap: 8, alignSelf: 'stretch', marginTop: 8 }}>
                  {c.starters.map((st) => <Pressable key={st} onPress={() => send(st)} style={s.starter}><T>{st}</T></Pressable>)}
                </View>
              </View>
            ) : undefined}
            renderItem={({ item }) => {
              const mine = item.role === 'user';
              return (
                <Animated.View entering={FadeInUp.duration(250)} style={[s.bubble, mine ? s.mine : s.theirs]}>
                  <T color={colors.text} selectable>{item.content}</T>
                </Animated.View>
              );
            }}
            ListFooterComponent={
              <View style={{ gap: 10 }}>
                {sending && outgoing && (
                  <>
                    <View style={[s.bubble, s.mine, { opacity: 0.75 }]}><T color={colors.text}>{outgoing}</T></View>
                    <Animated.View entering={FadeIn} style={[s.bubble, s.theirs, s.typing]}><Dot i={0} /><Dot i={1} /><Dot i={2} /></Animated.View>
                  </>
                )}
                {failed && (
                  <View style={{ gap: 8 }}>
                  <View style={[s.bubble, s.mine, { opacity: 0.6 }]}><T color={colors.text}>{failed.text}</T></View>
                  <View style={s.error}>
                    <Ionicons name="alert-circle" size={18} color={colors.danger} />
                    <T v="caption" style={{ flex: 1 }}>{failed.error}</T>
                    <Pressable accessibilityRole="button" onPress={() => send(failed.text)} style={s.retry}><T v="caption" style={{ fontFamily: fonts.bold }}>Retry</T></Pressable>
                  </View>
                  </View>
                )}
              </View>
            } />
        )}
        <View style={s.composer}>
          {quota && <T v="caption" color={colors.textMuted} style={{ position: 'absolute', top: -18, right: spacing.md }}>{Math.max(0, quota.msg_limit - quota.used)} AI messages left today</T>}
          <TextInput value={text} onChangeText={setText} placeholder={c ? `Message ${c.name}…` : 'Message…'} placeholderTextColor={colors.textMuted}
            multiline maxLength={2000} style={s.input} selectionColor={colors.primaryDeep} />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" disabled={!text.trim() || sending} onPress={() => send()} style={[s.send, (!text.trim() || sending) && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Ionicons name="arrow-up" size={20} color={colors.onPrimary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted },
  starter: { padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 16, backgroundColor: '#FFF1F4', borderWidth: 1, borderColor: '#FFE1E8' },
  retry: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.primary },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: spacing.md, paddingTop: 22, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
