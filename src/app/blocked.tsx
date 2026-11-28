import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState } from '@/components/ui';
import { Avatar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { blockedList, unblock } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';

export default function Blocked() {
  const toast = useToast();
  const [list, setList] = useState<{ id: string; name: string | null; photo_path: string | null }[] | null>(null);
  const load = () => blockedList().then(setList).catch((e) => { toast(friendlyError(e), 'error'); setList([]); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  return (
    <Screen>
      <StackHeader title={t('settings.blocked')} />
      <FlatList data={list ?? []} keyExtractor={(x) => x.id} contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={list === null ? <ActivityIndicator color={colors.text} /> : <EmptyState icon="happy-outline" title="—" />}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Avatar path={item.photo_path} name={item.name} size={44} />
            <Text style={s.name}>{item.name}</Text>
            <Pressable onPress={async () => { try { await unblock(item.id); load(); } catch (e) { toast(friendlyError(e), 'error'); } }} style={s.btn}><Text style={s.btnText}>✕</Text></Pressable>
          </View>
        )} />
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.white },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.bg },
  btnText: { fontFamily: fonts.bold, color: colors.text },
});
