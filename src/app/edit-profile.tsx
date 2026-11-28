import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { PhotoSourceSheet } from '@/components/PhotoSource';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, TextField } from '@/components/ui';
import { Chip } from '@/components/wif';
import { LANGUAGES } from '@/constants/languages';
import { colors, fonts } from '@/constants/theme';
import { catName, t } from '@/i18n';
import { deletePhotoFile, updateProfile, uploadPhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickPhoto, type PhotoSource } from '@/lib/media';
import { friendlyError, photoUrl } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';

/** Photos (main + 5), name, bio, interests, languages. */
export default function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const { boot, refresh } = useAuth();
  const { list } = useCategories();
  const p = boot!.profile;
  const [photos, setPhotos] = useState<string[]>([p.photo_path, ...p.gallery].filter(Boolean) as string[]);
  const [name, setName] = useState(p.display_name ?? '');
  const [bio, setBio] = useState(p.bio ?? '');
  const [interests, setInterests] = useState<string[]>(p.interests);
  const [langs, setLangs] = useState<string[]>(p.languages);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const persistPhotos = async (next: string[]) => { await updateProfile({ photo_path: next[0] ?? null, gallery: next.slice(1, 6) }); setPhotos(next); refresh(); };
  const add = async (src: PhotoSource) => {
    try { const img = await pickPhoto(src); if (!img) return; setUploading(true); const path = await uploadPhoto(img.uri, img.mime, 'g'); await persistPhotos([...photos, path].slice(0, 6)); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setUploading(false); }
  };
  const toggle = (arr: string[], set: (x: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const save = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try { await updateProfile({ display_name: name.trim(), bio: bio.trim() || null, interests, languages: langs }); await refresh(); router.back(); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Screen>
      <StackHeader title={t('profile.edit')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        <Text style={s.h}>{t('profile.photos')}</Text>
        <View style={s.grid}>
          {Array.from({ length: 6 }).map((_, i) => photos[i] ? (
            <Pressable key={photos[i]} onPress={() => setMenu(i)} style={s.slot}>
              <Image source={{ uri: photoUrl(photos[i]) }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {i === 0 && <View style={s.main}><Text style={s.mainText}>★</Text></View>}
            </Pressable>
          ) : (
            <Pressable key={`e${i}`} onPress={() => setSheet(true)} disabled={uploading || i > photos.length} style={[s.slot, s.empty, i > photos.length && { opacity: 0.4 }]}>
              {uploading && i === photos.length ? <ActivityIndicator color={colors.text} /> : <Ionicons name="add" size={26} color={colors.text} />}
            </Pressable>
          ))}
        </View>
        <Text style={s.h}>{t('setup.name')}</Text>
        <TextField value={name} onChangeText={setName} maxLength={30} />
        <Text style={s.h}>{t('setup.bio')}</Text>
        <TextField value={bio} onChangeText={setBio} maxLength={300} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
        <Text style={s.h}>{t('setup.interestsTitle')}</Text>
        <View style={s.wrap}>{list.filter((c) => c.id !== 'surprise').map((c) => <Chip key={c.id} emoji={c.emoji} label={catName(c)} on={interests.includes(c.id)} onPress={() => toggle(interests, setInterests, c.id)} />)}</View>
        <Text style={s.h}>{t('setup.languages')}</Text>
        <View style={s.wrap}>{LANGUAGES.map((l) => <Chip key={l.code} label={l.label} on={langs.includes(l.code)} onPress={() => toggle(langs, setLangs, l.code)} />)}</View>
        <GradientButton label={t('common.save')} loading={busy} onPress={save} disabled={name.trim().length < 2} />
      </ScrollView>
      <PhotoSourceSheet visible={sheet} onClose={() => setSheet(false)} onPick={add} />
      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)}>
        {menu !== null && menu > 0 && <SheetAction icon="star-outline" label="★ Main" onPress={() => { const i = menu; setMenu(null); const n = [photos[i], ...photos.filter((_, k) => k !== i)]; persistPhotos(n).catch((e) => toast(friendlyError(e), 'error')); }} />}
        <SheetAction icon="trash-outline" label={t('common.delete')} danger onPress={() => {
          const i = menu!; setMenu(null);
          const path = photos[i];
          persistPhotos(photos.filter((_, k) => k !== i)).then(() => deletePhotoFile(path)).catch((e) => toast(friendlyError(e), 'error'));
        }} />
      </BottomSheet>
    </Screen>
  );
}
const s = StyleSheet.create({
  h: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: { width: '31%', aspectRatio: 0.8, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.cream },
  empty: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primaryDeep },
  main: { position: 'absolute', left: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  mainText: { fontSize: 12, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
