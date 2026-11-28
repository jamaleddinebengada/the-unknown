import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { ReportSheet, type ReportTarget } from '@/components/ReportSheet';
import { GradientButton, IconButton, PremiumButton } from '@/components/ui';
import { Avatar, distLabel, whenLabel } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { catName, t } from '@/i18n';
import { getActivity, joinActivity, leaveActivity, respondJoin } from '@/lib/api';
import { friendlyError, photoUrl } from '@/lib/supabase';
import type { Activity } from '@/lib/types';
import { useCategories } from '@/lib/useCategories';
import { haptic } from '@/utils/format';

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { map } = useCategories();
  const [a, setA] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reportT, setReportT] = useState<ReportTarget>(null);
  const load = useCallback(() => { getActivity(id).then(setA).catch((e) => setError(friendlyError(e))); }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!a) return <View style={s.center}>{error ? <Text style={s.muted}>{error}</Text> : <ActivityIndicator color={colors.text} />}</View>;
  const cat = map.get(a.category);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); haptic.success(); load(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const approved = a.participants?.filter((p) => p.status === 'approved') ?? [];
  const pending = a.participants?.filter((p) => p.status === 'pending') ?? [];
  const cancelled = a.status === 'cancelled';

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={[s.cover, { backgroundColor: `${cat?.color ?? colors.primary}26` }]}>
          {a.cover_path ? <Image source={{ uri: photoUrl(a.cover_path) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ fontSize: 80 }}>{cat?.emoji}</Text>}
          <View style={[s.top, { top: insets.top + 10 }]}>
            <IconButton name="chevron-back" label={t('common.back')} onPress={() => router.back()} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton name="share-outline" label="Share" onPress={() => Share.share({ message: `${a.title} — ${whenLabel(a.starts_at)} · ${a.place_name} (WhoIsFree)` })} />
              {!a.is_host && <IconButton name="flag-outline" label={t('common.report')} onPress={() => setReportT({ activity: a.id, user: a.host.id })} />}
            </View>
          </View>
        </View>
        <View style={{ padding: 20, gap: 14 }}>
          <View style={s.catRow}><Text>{cat?.emoji}</Text><Text style={s.catText}>{catName(cat)}</Text></View>
          <Text style={s.title}>{a.title}</Text>
          {cancelled && <Text style={[s.muted, { color: colors.danger, fontSize: 14 }]}>❌ {t('notif.activity_cancelled', { title: a.title })}</Text>}
          <View style={s.info}><Ionicons name="time" size={18} color={colors.text} /><Text style={s.infoText}>{whenLabel(a.starts_at)}</Text></View>
          <View style={s.info}><Ionicons name="location" size={18} color={colors.text} /><Text style={s.infoText}>{a.place_name}{a.city ? `, ${a.city}` : ''}{a.distance ? ` · ${distLabel(a.distance)}` : ''}</Text></View>
          <View style={s.info}><Ionicons name="people" size={18} color={colors.text} /><Text style={s.infoText}>{t('act.going', { n: a.going, max: a.max })}</Text></View>
          {!!a.price && <View style={s.info}><Ionicons name="pricetag" size={18} color={colors.text} /><Text style={s.infoText}>{a.price}</Text></View>}
          {!!a.description && <Text style={s.body}>{a.description}</Text>}

          <Text style={s.h}>{t('act.host')}</Text>
          <Pressable onPress={() => router.push({ pathname: '/person/[id]', params: { id: a.host.id } })} style={s.host}>
            <Avatar path={a.host.photo_path} name={a.host.name} size={48} />
            <Text style={s.hostName}>{a.host.name}</Text>
            {a.host.verified && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
          </Pressable>

          {a.is_host && pending.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={s.h}>{t('act.requests')} · {pending.length}</Text>
              {pending.map((p) => (
                <View key={p.id} style={s.reqRow}>
                  <Pressable onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Avatar path={p.photo_path} name={p.name} size={42} />
                    <View style={{ flex: 1 }}><Text style={s.hostName}>{p.name}</Text>{!!p.message && <Text style={s.muted} numberOfLines={2}>{p.message}</Text>}</View>
                  </Pressable>
                  <Pressable onPress={() => run(p.id + 'y', () => respondJoin(a.id, p.id, true))} style={[s.small, { backgroundColor: colors.primary }]}><Ionicons name="checkmark" size={18} color={colors.text} /></Pressable>
                  <Pressable onPress={() => run(p.id + 'n', () => respondJoin(a.id, p.id, false))} style={s.small}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
                </View>
              ))}
            </View>
          )}
          {approved.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={s.h}>{t('act.participants')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {approved.map((p) => <Pressable key={p.id} onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} style={{ alignItems: 'center', gap: 4, width: 64 }}><Avatar path={p.photo_path} name={p.name} size={52} /><Text style={s.muted} numberOfLines={1}>{p.name}</Text></Pressable>)}
              </View>
            </View>
          )}
          <View style={s.safety}><Ionicons name="shield-checkmark" size={18} color={colors.online} /><Text style={s.safetyText}>{t('act.safety')}</Text></View>
        </View>
      </ScrollView>
      {!cancelled && (
        <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
          {a.conversation_id && <PremiumButton icon="chatbubbles" label={t('act.chat')} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: a.conversation_id! } })} style={{ flex: 1 }} />}
          {a.is_host ? (
            <PremiumButton tone="danger" label={t('act.cancel')} loading={busy === 'leave'} style={{ flex: 1 }}
              onPress={() => Alert.alert(t('act.cancel'), a.title, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('act.cancel'), style: 'destructive', onPress: () => run('leave', () => leaveActivity(a.id)) }])} />
          ) : a.my_status === 'approved' ? (
            <PremiumButton label={t('act.leave')} loading={busy === 'leave'} style={{ flex: 1 }} onPress={() => run('leave', () => leaveActivity(a.id))} />
          ) : a.my_status === 'pending' ? (
            <PremiumButton icon="time-outline" label={t('act.pending')} disabled style={{ flex: 1 }} onPress={() => {}} />
          ) : a.my_status === 'declined' ? (
            <PremiumButton label={t('act.declined')} disabled style={{ flex: 1 }} onPress={() => {}} />
          ) : (
            <GradientButton icon="hand-right" label={t('act.join')} loading={busy === 'join'} disabled={a.going >= a.max} style={{ flex: 1 }} onPress={() => run('join', () => joinActivity(a.id))} />
          )}
        </View>
      )}
      <ReportSheet target={reportT} onClose={() => setReportT(null)} />
    </View>
  );
}
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.white },
  cover: { height: 260, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  top: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primarySoft },
  catText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.text },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  h: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, marginTop: 4 },
  host: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostName: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 16, backgroundColor: colors.bg },
  small: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  muted: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  safety: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: '#ECFDF3' },
  safetyText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text, lineHeight: 19 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
