import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui';
import { Avatar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { catName, t, type TKey } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { photoUrl } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';
import { ageFromDate } from '@/utils/format';

type Row = { icon: keyof typeof Ionicons.glyphMap; label: TKey; to: string; color?: string };

/** My profile: photo, name, interests and shortcuts. */
export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { boot } = useAuth();
  const { map } = useCategories();
  const p = boot?.profile;
  if (!p) return null;
  const rows: Row[] = [
    { icon: 'calendar', label: 'profile.myActivities', to: '/activities?mode=mine' },
    { icon: 'images', label: 'home.moments', to: '/moments' },
    { icon: 'diamond', label: 'profile.premium', to: '/premium', color: colors.vip },
    { icon: 'shield-checkmark', label: 'profile.safety', to: '/safety', color: colors.online },
    { icon: 'settings', label: 'profile.settings', to: '/settings' },
    ...(p.is_admin ? [{ icon: 'hammer', label: 'profile.admin', to: '/admin' } as Row] : []),
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 30, paddingHorizontal: 20, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={s.title}>{t('tabs.profile')}</Text>
        <IconButton name="settings-outline" label={t('profile.settings')} onPress={() => router.push('/settings')} />
      </View>
      <View style={s.card}>
        <Pressable onPress={() => router.push('/edit-profile')} style={s.photoWrap} accessibilityLabel={t('profile.photos')}>
          {p.photo_path ? <Image source={{ uri: photoUrl(p.photo_path) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Avatar name={p.display_name} size={120} />}
          <View style={s.edit}><Ionicons name="camera" size={16} color={colors.text} /></View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.name}>{p.display_name}{p.birth_date ? `, ${ageFromDate(p.birth_date)}` : ''}</Text>
          {p.is_verified && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
        </View>
        <Text style={s.city}>📍 {boot?.zone?.city ?? p.city ?? '—'}</Text>
        {!!p.bio && <Text style={s.bio}>{p.bio}</Text>}
        <View style={s.wrap}>{p.interests.slice(0, 8).map((c) => <View key={c} style={s.tag}><Text>{map.get(c)?.emoji}</Text><Text style={s.tagText}>{catName(map.get(c))}</Text></View>)}</View>
        <Pressable onPress={() => router.push('/edit-profile')} style={s.editBtn} accessibilityRole="button"><Ionicons name="create-outline" size={18} color={colors.text} /><Text style={s.editText}>{t('profile.edit')}</Text></Pressable>
      </View>
      <View style={s.list}>
        {rows.map((r, i) => (
          <Pressable key={r.label} onPress={() => router.push(r.to as never)} style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
            <View style={[s.rowIcon, { backgroundColor: `${r.color ?? colors.accent}1A` }]}><Ionicons name={r.icon} size={18} color={r.color ?? colors.accent} /></View>
            <Text style={s.rowText}>{t(r.label)}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.6 },
  card: { alignItems: 'center', gap: 8, padding: 20, borderRadius: 26, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  photoWrap: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.primary },
  edit: { position: 'absolute', right: 4, bottom: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text },
  city: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  bio: { fontFamily: fonts.regular, fontSize: 14.5, color: colors.textSecondary, textAlign: 'center', lineHeight: 21 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: colors.primarySoft },
  tagText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.text },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.primary },
  editText: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  list: { borderRadius: 22, backgroundColor: colors.white, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
