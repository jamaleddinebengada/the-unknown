import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { PhotoSourceSheet } from '@/components/PhotoSource';
import { GradientButton, IconButton, TextField } from '@/components/ui';
import { CategoryTile, Chip } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { createActivity, uploadPhoto } from '@/lib/api';
import { pickPhoto, type PhotoSource } from '@/lib/media';
import { friendlyError, photoUrl } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';

const DAYS = [0, 1, 2, 3, 4, 5, 6];
const TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

/** Create a real-world activity people can request to join (with its own group chat). */
export default function NewActivity() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { list } = useCategories();
  const [cat, setCat] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [day, setDay] = useState(0);
  const [time, setTime] = useState(() => { const h = new Date().getHours() + 2; return TIMES.find((x) => Number(x.slice(0, 2)) >= h) ?? '20:00'; });
  const [place, setPlace] = useState('');
  const [max, setMax] = useState(4);
  const [price, setPrice] = useState('');
  const [cover, setCover] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const dayDate = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x; };
  const startsAt = () => { const x = dayDate(day); const [h, m] = time.split(':').map(Number); x.setHours(h, m, 0, 0); return x; };
  const pick = async (src: PhotoSource) => {
    try { const img = await pickPhoto(src, [16, 9]); if (!img) return; setUploading(true); setCover(await uploadPhoto(img.uri, img.mime, 'cover')); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setUploading(false); }
  };
  const publish = async () => {
    const st = startsAt();
    if (st.getTime() < Date.now() - 5 * 60000) { toast(friendlyError(new Error('invalid_date')), 'error'); return; }
    setBusy(true);
    try {
      const a = await createActivity({ category: cat!, title, description: desc, startsAt: st, place, max, price, cover });
      router.replace({ pathname: '/activity/[id]', params: { id: a.id } });
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={[s.head, { paddingTop: insets.top + 6 }]}>
        <IconButton name="close" label={t('common.cancel')} onPress={() => router.back()} />
        <Text style={s.title}>{t('act.create')}</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => setSheet(true)} style={s.cover} accessibilityLabel={t('act.cover')}>
          {cover ? <Image source={{ uri: photoUrl(cover) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <><Ionicons name="image-outline" size={28} color={colors.text} /><Text style={s.coverText}>{t('act.cover')}</Text></>}
          {uploading && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' }]}><ActivityIndicator /></View>}
        </Pressable>
        <Text style={s.q}>{t('act.category')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 }}>
          {list.filter((c) => c.id !== 'surprise').map((c) => <CategoryTile key={c.id} c={c} size={58} selected={cat === c.id} onPress={() => setCat(c.id)} />)}
        </ScrollView>
        <Text style={s.q}>{t('act.title')}</Text>
        <TextField value={title} onChangeText={setTitle} maxLength={80} placeholder={t('act.titlePlaceholder')} accessibilityLabel={t('act.title')} />
        <Text style={s.q}>{t('act.when')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {DAYS.map((d) => <Chip key={d} label={d === 0 ? t('act.today') : d === 1 ? t('act.tomorrow') : dayDate(d).toLocaleDateString([], { weekday: 'short', day: 'numeric' })} on={day === d} onPress={() => setDay(d)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TIMES.map((x) => <Chip key={x} label={x} on={time === x} onPress={() => setTime(x)} />)}
        </ScrollView>
        <Text style={s.q}>{t('act.place')}</Text>
        <TextField value={place} onChangeText={setPlace} maxLength={120} placeholder={t('act.placePlaceholder')} icon="location-outline" accessibilityLabel={t('act.place')} />
        <Text style={s.hint}>🛡️ {t('act.publicPlace')}</Text>
        <Text style={s.q}>{t('act.people')}</Text>
        <View style={s.wrap}>{[2, 3, 4, 6, 8, 10, 20].map((n) => <Chip key={n} label={String(n)} on={max === n} onPress={() => setMax(n)} />)}</View>
        <Text style={s.q}>{t('act.price')}</Text>
        <TextField value={price} onChangeText={setPrice} maxLength={40} placeholder={t('act.pricePlaceholder')} />
        <Text style={s.q}>{t('act.description')}</Text>
        <TextField value={desc} onChangeText={setDesc} maxLength={1000} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
      </ScrollView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <GradientButton icon="megaphone" label={t('act.publish')} loading={busy} disabled={!cat || title.trim().length < 3 || place.trim().length < 2} onPress={publish} />
      </View>
      <PhotoSourceSheet visible={sheet} onClose={() => setSheet(false)} onPick={pick} />
    </View>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  cover: { height: 150, borderRadius: 20, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primaryDeep },
  coverText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  q: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, marginTop: 6 },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foot: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
