import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { ReportSheet, type ReportTarget } from '@/components/ReportSheet';
import { GradientButton, PremiumButton, TextField } from '@/components/ui';
import { Avatar, distLabel, LivePill } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { catName, duration, t } from '@/i18n';
import { block, getPerson, respondRequest, sendRequest } from '@/lib/api';
import { friendlyError, photoUrl } from '@/lib/supabase';
import type { Person } from '@/lib/types';
import { useCategories } from '@/lib/useCategories';
import { langName } from '@/constants/languages';
import { haptic } from '@/utils/format';

/** Public profile: photos, live availability, why you match (real shared data only), request / chat. */
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { map } = useCategories();
  const [p, setP] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState(false);
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [match, setMatch] = useState<string | null>(null);
  const [reportT, setReportT] = useState<ReportTarget>(null);

  const load = useCallback(() => { getPerson(id).then(setP).catch((e) => setError(friendlyError(e))); }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!p) return <View style={[s.center, { paddingTop: insets.top }]}>{error ? <Text style={s.err}>{error}</Text> : <ActivityIndicator color={colors.text} />}</View>;

  const photos = [p.photo_path, ...(p.gallery ?? [])].filter(Boolean) as string[];
  const h = width * 1.2;
  const cat = (c: string) => map.get(c);
  const sharedCats = [...new Set([...(p.free?.shared_categories ?? []), ...p.shared_interests])].map((c) => catName(cat(c))).filter(Boolean);
  const req = p.request;

  const send = async () => {
    setBusy(true);
    try {
      const r = await sendRequest(p.id, msg, p.free?.categories?.[0] ?? null);
      haptic.success(); setAsk(false);
      if (r.status === 'accepted' && r.conversation_id) setMatch(r.conversation_id); else toast(t('person.requested'), 'success');
      load();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };
  const accept = async () => {
    if (!req) return;
    setBusy(true);
    try { const r = await respondRequest(req.id, true); haptic.success(); if (r.conversation_id) setMatch(r.conversation_id); load(); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ height: h, backgroundColor: colors.cream }}>
          {photos.length ? (
            <FlatList data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(x) => x}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item }) => <Image source={{ uri: photoUrl(item) }} style={{ width, height: h }} contentFit="cover" transition={200} />} />
          ) : <View style={s.noPhoto}><Avatar name={p.name} size={140} /></View>}
          <LinearGradient colors={['rgba(24,32,43,0.35)', 'transparent']} style={[StyleSheet.absoluteFill, { bottom: h * 0.7 }]} pointerEvents="none" />
          {photos.length > 1 && <View style={[s.dots, { top: insets.top + 8 }]}>{photos.map((x, i) => <View key={x} style={[s.dot, i === page && { backgroundColor: '#fff' }]} />)}</View>}
          <View style={[s.topBtns, { top: insets.top + 18 }]}>
            <Pressable onPress={() => router.back()} style={s.glass} accessibilityLabel={t('common.back')}><Ionicons name="chevron-back" size={22} color="#fff" /></Pressable>
            {!p.is_me && <Pressable onPress={() => setMenu(true)} style={s.glass} accessibilityLabel="More"><Ionicons name="ellipsis-horizontal" size={22} color="#fff" /></Pressable>}
          </View>
        </View>

        <View style={{ padding: 20, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.name}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
            {p.verified && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
          </View>
          <Text style={s.meta}>📍 {[p.city, distLabel(p.distance)].filter(Boolean).join(' · ')}{p.online ? ' · 🟢 online' : ''}</Text>

          {p.free ? (
            <View style={s.freeCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={s.freeTitle}>⚡ {t('person.free', { time: duration(new Date(p.free.until).getTime() - Date.now()) })}</Text>
                <LivePill until={p.free.until} />
              </View>
              <View style={s.wrap}>{p.free.categories.map((c) => <View key={c} style={s.tag}><Text>{cat(c)?.emoji}</Text><Text style={s.tagText}>{catName(cat(c))}</Text></View>)}</View>
              {!!p.free.note && <Text style={s.note}>“{p.free.note}”</Text>}
            </View>
          ) : <Text style={s.muted}>{t('person.notFree')}</Text>}

          {!p.is_me && (sharedCats.length > 0 || p.shared_languages.length > 0 || p.free) && (
            <View style={s.why}>
              <Text style={s.h}>{t('person.why')}</Text>
              {sharedCats.length > 0 && <Text style={s.whyLine}>• {t('person.shared', { list: sharedCats.slice(0, 3).join(', ') })}</Text>}
              {p.shared_languages.length > 0 && <Text style={s.whyLine}>• {t('person.sharedLang', { list: p.shared_languages.map(langName).join(', ') })}</Text>}
              {p.free && <Text style={s.whyLine}>• {t('person.freeTogether', { name: p.name ?? '', time: duration(new Date(p.free.until).getTime() - Date.now()) })}</Text>}
            </View>
          )}

          {!!p.bio && <View style={{ gap: 6 }}><Text style={s.h}>{t('person.about')}</Text><Text style={s.body}>{p.bio}</Text></View>}
          {p.interests.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={s.h}>{t('person.interests')}</Text>
              <View style={s.wrap}>{p.interests.map((c) => <View key={c} style={[s.tag, p.shared_interests.includes(c) && { backgroundColor: colors.primary }]}><Text>{cat(c)?.emoji}</Text><Text style={s.tagText}>{catName(cat(c))}</Text></View>)}</View>
            </View>
          )}
          {p.languages.length > 0 && <View style={{ gap: 6 }}><Text style={s.h}>{t('person.languages')}</Text><Text style={s.body}>{p.languages.map(langName).join(' · ')}</Text></View>}
        </View>
      </ScrollView>

      {!p.is_me && (
        <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
          {p.conversation_id ? <GradientButton icon="chatbubble" label={t('person.message')} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: p.conversation_id! } })} />
            : req?.status === 'pending' && req.incoming ? <GradientButton icon="checkmark" label={t('person.accept')} loading={busy} onPress={accept} />
            : req?.status === 'pending' ? <PremiumButton icon="time-outline" label={t('person.requested')} disabled onPress={() => {}} />
            : <GradientButton icon="hand-left" label={t('person.connect')} onPress={() => setAsk(true)} />}
        </View>
      )}

      <BottomSheet visible={ask} onClose={() => setAsk(false)} title={t('person.connect')}>
        <View style={{ gap: 12 }}>
          <TextField value={msg} onChangeText={setMsg} maxLength={200} placeholder={t('person.requestMessage')} multiline style={{ minHeight: 60, textAlignVertical: 'top' }} />
          <GradientButton label={t('person.connect')} loading={busy} onPress={send} />
        </View>
      </BottomSheet>
      <BottomSheet visible={menu} onClose={() => setMenu(false)}>
        <SheetAction icon="flag-outline" label={t('common.report')} onPress={() => { setMenu(false); setReportT({ user: p.id }); }} />
        <SheetAction icon="ban-outline" label={t('common.block')} danger onPress={() => {
          setMenu(false);
          Alert.alert(t('common.block'), p.name ?? '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.block'), style: 'destructive', onPress: async () => {
            try { await block(p.id); toast(t('block.done'), 'success'); router.back(); } catch (e) { toast(friendlyError(e), 'error'); }
          } }]);
        }} />
      </BottomSheet>
      <ReportSheet target={reportT} onClose={() => setReportT(null)} />
      <Modal visible={!!match} transparent animationType="fade" onRequestClose={() => setMatch(null)}>
        <View style={s.matchBg}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={s.matchCard}>
            <Text style={{ fontSize: 54 }}>🎉</Text>
            <Text style={s.matchTitle}>{t('person.matchTitle')}</Text>
            <Text style={s.matchBody}>{t('person.matchBody')}</Text>
            <GradientButton icon="chatbubble" label={t('person.message')} onPress={() => { const c = match!; setMatch(null); router.push({ pathname: '/chat/[id]', params: { id: c } }); }} style={{ alignSelf: 'stretch' }} />
            <Text onPress={() => setMatch(null)} style={s.later}>{t('setup.later')}</Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, padding: 24 },
  err: { fontFamily: fonts.medium, color: colors.textMuted, textAlign: 'center' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 4 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.45)' },
  topBtns: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  glass: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(24,32,43,0.35)', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.6, flexShrink: 1 },
  meta: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, marginTop: -8 },
  freeCard: { gap: 10, padding: 16, borderRadius: 20, backgroundColor: colors.primarySoft },
  freeTitle: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, flexShrink: 1 },
  note: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' },
  muted: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  why: { gap: 6, padding: 16, borderRadius: 20, backgroundColor: colors.lavender },
  whyLine: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, lineHeight: 20 },
  h: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.bg },
  tagText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  matchBg: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  matchCard: { alignSelf: 'stretch', alignItems: 'center', gap: 12, padding: 24, borderRadius: 28, backgroundColor: colors.white },
  matchTitle: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text },
  matchBody: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  later: { fontFamily: fonts.semibold, color: colors.textMuted, padding: 6 },
});
