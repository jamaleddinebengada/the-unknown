import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { Avatar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { adminOverview, adminReports, adminResolve } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';

type Reports = Awaited<ReturnType<typeof adminReports>>;

/** Admin: key numbers + report queue. Every action is re-checked on the server (wif_profiles.is_admin) and audited. */
export default function Admin() {
  const toast = useToast();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [reports, setReports] = useState<Reports | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [o, r] = await Promise.all([adminOverview(), adminReports()]); setStats(o); setReports(r); } catch (e) { setError(friendlyError(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const act = async (id: string, a: 'dismiss' | 'suspend' | 'remove_content' | 'remove_photos') => {
    try { await adminResolve(id, a); toast('✓', 'success'); load(); } catch (e) { toast(friendlyError(e), 'error'); }
  };
  return (
    <Screen>
      <StackHeader title="Admin" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {error ? <Text style={s.muted}>{error}</Text> : !stats ? <ActivityIndicator color={colors.text} /> : (
          <View style={s.stats}>{Object.entries(stats).map(([k, v]) => <View key={k} style={s.stat}><Text style={s.v}>{v}</Text><Text style={s.k}>{k.replace('_', ' ')}</Text></View>)}</View>
        )}
        <Text style={s.h}>Reports · {reports?.length ?? 0}</Text>
        {reports?.map((r) => (
          <View key={r.id} style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar path={r.target?.photo_path} name={r.target?.name} size={40} />
              <View style={{ flex: 1 }}><Text style={s.name}>{r.target?.name ?? '—'} · {r.reason}</Text><Text style={s.muted}>{r.reports_on_target} report(s) · {new Date(r.created_at).toLocaleDateString()}</Text></View>
            </View>
            {!!(r.details || r.post || r.activity) && <Text style={s.quote}>{r.details ?? r.post ?? r.activity}</Text>}
            <View style={s.row}>
              {(['dismiss', 'remove_content', 'remove_photos', 'suspend'] as const).map((a) => (
                <Pressable key={a} onPress={() => act(r.id, a)} style={[s.btn, a === 'suspend' && { borderColor: colors.danger }]}><Text style={[s.btnText, a === 'suspend' && { color: colors.danger }]}>{a.replace('_', ' ')}</Text></Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '31%', flexGrow: 1, padding: 12, borderRadius: 16, backgroundColor: colors.white },
  v: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  k: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted, textTransform: 'capitalize' },
  h: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.white },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  quote: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, padding: 10, borderRadius: 12, backgroundColor: colors.bg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  btnText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text, textTransform: 'capitalize' },
});
