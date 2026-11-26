import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { AiPortrait } from '@/components/AiPortrait';
import { useAiCharacters } from '@/features/ai/useAiCharacters';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, PremiumButton, T, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import {
  adminClearCharacterPortrait, adminLookupUser, adminOverview, adminUploadCharacterPortrait, adminReports, adminResolveReport, adminReviewVerification, adminSetUserStatus, adminVerifications,
  verificationSelfieUrl, type AdminOverview, type AdminReport, type AdminVerification,
} from '@/services/api';

type Tab = 'reports' | 'verify' | 'users' | 'characters';

/** Moderation dashboard. Every action is re-checked on the server (profiles.is_admin) and logged. */
export default function Admin() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('reports');
  const [stats, setStats] = useState<AdminOverview | null>(null);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [verifs, setVerifs] = useState<(AdminVerification & { url?: string | null })[]>([]);
  const [denied, setDenied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [lookup, setLookup] = useState('');
  const [user, setUser] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, r, v] = await Promise.all([adminOverview(), adminReports('open'), adminVerifications()]);
      setStats(o); setReports(r);
      setVerifs(await Promise.all(v.map(async (x) => ({ ...x, url: await verificationSelfieUrl(x.path) }))));
    } catch (e) {
      if (String((e as Error).message).includes('not_allowed')) setDenied(true); else toast(friendlyError(e), 'error');
    } finally { setRefreshing(false); }
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try { await fn(); toast(done, 'success'); await load(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const resolve = (r: AdminReport, action: 'dismiss' | 'remove_content' | 'suspend_user' | 'ban_user') => {
    const go = () => act(r.id + action, () => adminResolveReport(r.id, action), 'Done');
    if (action === 'ban_user') Alert.alert('Ban this member?', `#${r.target_number} will lose access.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Ban', style: 'destructive', onPress: go }]);
    else go();
  };

  if (denied) return (
    <Screen edges={['top']}><StackHeader title="Moderation" />
      <View style={{ padding: spacing.lg, alignItems: 'center', gap: 10 }}><Ionicons name="lock-closed" size={36} color={colors.textMuted} /><T color={colors.textMuted} style={{ textAlign: 'center' }}>Only moderators can open this dashboard.</T></View>
    </Screen>
  );

  return (
    <Screen edges={['top']}>
      <StackHeader title="Moderation" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        {!stats ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
          <View style={s.stats}>
            {([['Members', stats.members], ['Active 24h', stats.active_24h], ['New 7d', stats.new_7d], ['Nearby on', stats.nearby_on],
              ['Open reports', stats.open_reports], ['To verify', stats.pending_verifications], ['Premium', stats.premium], ['Suspended', stats.suspended]] as const).map(([k, v]) => (
              <View key={k} style={s.stat}><Text style={s.statV}>{v}</Text><T v="caption" color={colors.textMuted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{k}</T></View>
            ))}
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {([['reports', `Reports · ${reports.length}`], ['verify', `Verify · ${verifs.length}`], ['users', 'Members'], ['characters', 'AI']] as const).map(([k, l]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}><Text style={[s.tabText, tab === k && { color: colors.onPrimary }]}>{l}</Text></Pressable>
          ))}
        </ScrollView>

        {tab === 'reports' && (reports.length === 0 ? <T color={colors.textMuted} style={{ textAlign: 'center', padding: 20 }}>No open reports. 🎉</T> : reports.map((r) => (
          <View key={r.id} style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={s.cardTitle}>{r.type.toUpperCase()} · {r.reason}</Text>
              <T v="caption" color={colors.textMuted}>{new Date(r.created_at).toLocaleDateString()}</T>
            </View>
            <T v="caption" color={colors.textMuted}>Reported member #{r.target_number ?? '—'}{r.target_name ? ` (${r.target_name})` : ''} · {r.target_reports} report(s) · {r.target_status} · by #{r.reporter ?? '—'}</T>
            {!!r.content && <View style={s.quote}><T numberOfLines={5}>{r.content}</T></View>}
            {!!r.details && <T v="caption">“{r.details}”</T>}
            <View style={s.row}>
              <Btn label="Dismiss" onPress={() => resolve(r, 'dismiss')} busy={busy === r.id + 'dismiss'} />
              {r.type !== 'user' && <Btn label="Remove" onPress={() => resolve(r, 'remove_content')} busy={busy === r.id + 'remove_content'} />}
              <Btn label="Suspend" warn onPress={() => resolve(r, 'suspend_user')} busy={busy === r.id + 'suspend_user'} />
              <Btn label="Ban" danger onPress={() => resolve(r, 'ban_user')} busy={busy === r.id + 'ban_user'} />
            </View>
          </View>
        )))}

        {tab === 'verify' && (verifs.length === 0 ? <T color={colors.textMuted} style={{ textAlign: 'center', padding: 20 }}>No selfies waiting.</T> : verifs.map((v) => (
          <View key={v.id} style={s.card}>
            <Text style={s.cardTitle}>#{v.number}{v.name ? ` · ${v.name}` : ''}</Text>
            <T v="caption" color={colors.textMuted}>Requested gesture: {v.gesture.replace('_', ' ')} · compare with the profile photos</T>
            {v.url ? <Image source={{ uri: v.url }} style={s.selfie} contentFit="cover" /> : <T color={colors.textMuted}>Selfie unavailable</T>}
            <View style={s.row}>
              <Btn label="Approve" ok onPress={() => act(v.id + 'a', () => adminReviewVerification(v.id, true), 'Verified')} busy={busy === v.id + 'a'} />
              <Btn label="Reject" danger onPress={() => act(v.id + 'r', () => adminReviewVerification(v.id, false, 'The selfie did not match the photos or gesture.'), 'Rejected')} busy={busy === v.id + 'r'} />
            </View>
          </View>
        )))}

        {tab === 'users' && (
          <View style={s.card}>
            <TextField value={lookup} onChangeText={(x) => setLookup(x.replace(/\D/g, ''))} placeholder="Member number, e.g. 10427" keyboardType="number-pad" icon="search" />
            <GradientButton small label="Look up" disabled={!lookup} loading={busy === 'lookup'} onPress={async () => { setBusy('lookup'); try { setUser(await adminLookupUser(Number(lookup))); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); } }} />
            {user === null ? null : (
              <View style={{ gap: 6 }}>
                {Object.entries(user).map(([k, v]) => <T key={k} v="caption"><Text style={{ fontFamily: fonts.semibold }}>{k}: </Text>{String(v)}</T>)}
                <View style={s.row}>
                  {(['active', 'suspended', 'banned'] as const).map((st) => (
                    <Btn key={st} label={st} danger={st === 'banned'} warn={st === 'suspended'} ok={st === 'active'} busy={busy === st}
                      onPress={() => act(st, async () => { await adminSetUserStatus(Number(lookup), st); setUser(await adminLookupUser(Number(lookup))); }, `Status: ${st}`)} />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
        {tab === 'characters' && <CharacterPortraits />}
        <PremiumButton label="Refresh" tone="ghost" onPress={() => load()} />
      </ScrollView>
    </Screen>
  );
}

function Btn({ label, onPress, busy, danger, warn, ok }: { label: string; onPress: () => void; busy?: boolean; danger?: boolean; warn?: boolean; ok?: boolean }) {
  const c = danger ? colors.danger : warn ? '#B7791F' : ok ? colors.online : colors.primary;
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [s.btn, { borderColor: c }, pressed && { opacity: 0.7 }]}>
      {busy ? <ActivityIndicator size="small" color={c} /> : <Text style={[s.btnText, { color: c }]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '23%', flexGrow: 1, padding: 10, borderRadius: 14, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statV: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  card: { gap: 8, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, flexShrink: 1 },
  quote: { padding: 10, borderRadius: 10, backgroundColor: colors.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, minWidth: 74, alignItems: 'center' },
  btnText: { fontFamily: fonts.semibold, fontSize: 13, textTransform: 'capitalize' },
  selfie: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12 },
});

/** Give each fictional AI character a realistic portrait (e.g. generated with an image AI). Shown to everyone at once. */
function CharacterPortraits() {
  const toast = useToast();
  const { list, refresh } = useAiCharacters();
  const [busy, setBusy] = useState<string | null>(null);
  const upload = async (id: string) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
    if (r.canceled || !r.assets[0]) return;
    const a = r.assets[0];
    setBusy(id);
    try { await adminUploadCharacterPortrait(id, a.uri, a.mimeType ?? 'image/jpeg'); toast('Portrait updated', 'success'); refresh(); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  if (!list) return <ActivityIndicator color={colors.primary} />;
  return (
    <View style={{ gap: 8 }}>
      <T v="caption" color={colors.textMuted}>Use portraits of fictional people only (for example made with an image AI). Never use photos of real people. The app keeps the “Fictional AI character” labels.</T>
      {list.map((c) => (
        <View key={c.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <AiPortrait seed={c.avatar_seed} portrait={c.portrait_url} accent={c.accent} size={56} rounded="card" />
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{c.name}</Text>
            <T v="caption" color={colors.textMuted}>{c.role} · {c.portrait_url ? 'photo' : 'illustration'}</T>
          </View>
          <Btn label={c.portrait_url ? 'Change' : 'Upload'} busy={busy === c.id} onPress={() => upload(c.id)} />
          {!!c.portrait_url && <Btn label="Reset" danger onPress={async () => { await adminClearCharacterPortrait(c.id).catch(() => {}); refresh(); }} />}
        </View>
      ))}
    </View>
  );
}
