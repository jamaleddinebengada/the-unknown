import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { PhotoSourceSheet } from '@/features/profile/PhotoSourceSheet';
import { pickPhoto, type PhotoSource } from '@/lib/media';
import { friendlyError } from '@/lib/supabase';
import { updateMyProfile } from '@/services/api';
import { addPhoto, deleteMainPhoto, getMyPhotos, makeMainPhoto, MAX_PHOTOS, removeGalleryPhoto, type MyPhotos } from '@/services/photos';
import { haptic } from '@/utils/format';

type Slot = { path: string; url: string; main: boolean };

/** Up to 6 photos: camera or gallery, cropped 4:5, compressed, stored privately; choose who can see them. */
export default function Photos() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, refreshProfile } = useAuth();
  const [mine, setMine] = useState<MyPhotos | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(false);
  const [menu, setMenu] = useState<Slot | null>(null);

  const load = useCallback(() => { getMyPhotos().then(setMine).catch((e) => toast(friendlyError(e), 'error')); }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const slots: Slot[] = mine ? [
    ...(mine.photo_path && mine.photoUrl ? [{ path: mine.photo_path, url: mine.photoUrl, main: true }] : []),
    ...mine.gallery.map((p, i) => ({ path: p, url: mine.galleryUrls[i], main: false })).filter((x) => x.url),
  ] : [];
  const isPublic = profile?.photo_visibility === 'public';

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await fn(); haptic.success(); toast(done, 'success'); load(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };
  const add = async (src: PhotoSource) => {
    try {
      const img = await pickPhoto(src);
      if (!img) return;
      const first = slots.length === 0;
      await run(async () => {
        await addPhoto(img.uri, img.mime);
        // first photo: show it in Nearby unless the person chose anonymous mode before
        if (first && profile?.photo_visibility !== 'hidden') { await updateMyProfile({ photo_visibility: 'public' }); await refreshProfile(); }
      }, 'Photo added');
    } catch (e) { toast(friendlyError(e), 'error'); }
  };
  const setVisibility = (pub: boolean) => run(async () => { await updateMyProfile({ photo_visibility: pub ? 'public' : 'revealed' }); await refreshProfile(); },
    pub ? 'Your photos are visible in Nearby' : 'Anonymous mode: photos only after a mutual reveal');

  const gap = 8;
  const big = width - spacing.md * 2;
  const small = (big - gap * 2) / 3;

  return (
    <Screen edges={['top']}>
      <StackHeader title="My photos" />
      {!mine ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: insets.bottom + 40 }}>
          <T color={colors.textMuted}>Add up to {MAX_PHOTOS} photos of yourself. Your first photo is the one people see on your card.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
            {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
              const sl = slots[i];
              const w = i === 0 ? big : small;
              const h = i === 0 ? big * 1.1 : small * 1.25;
              return sl ? (
                <Animated.View key={sl.path} entering={FadeIn}>
                  <Pressable onPress={() => setMenu(sl)} accessibilityLabel={sl.main ? 'Main photo' : `Photo ${i + 1}`} style={[s.slot, { width: w, height: h }]}>
                    <Image source={{ uri: sl.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    {sl.main && <View style={s.mainTag}><Text style={s.mainText}>Main photo</Text></View>}
                    <View style={s.edit}><Ionicons name="ellipsis-horizontal" size={16} color="#fff" /></View>
                  </Pressable>
                </Animated.View>
              ) : (
                <Pressable key={`empty-${i}`} onPress={() => setSource(true)} disabled={busy || i > slots.length} accessibilityRole="button" accessibilityLabel="Add a photo"
                  style={[s.slot, s.empty, { width: w, height: h, opacity: i > slots.length ? 0.45 : 1 }]}>
                  {busy && i === slots.length ? <ActivityIndicator color={colors.primary} /> : (
                    <><View style={s.plus}><Ionicons name="add" size={22} color="#fff" /></View>
                      {i === 0 && <Text style={s.emptyText}>Add your main photo</Text>}</>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name={isPublic ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Show my photos in Nearby & Discover</Text>
                <T v="caption" color={colors.textMuted}>{isPublic ? 'Members see your main photo on your card.' : 'Anonymous mode: your photos appear only after you both agree to reveal.'}</T>
              </View>
              <Switch value={isPublic} onValueChange={setVisibility} disabled={busy || slots.length === 0} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
            </View>
          </View>
          <View style={s.tips}>
            {['Clear photo of your face, no filters', 'Only photos of you — never someone else', 'No nudity, violence or contact details'].map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Ionicons name="checkmark-circle" size={16} color={colors.online} /><T v="caption">{t}</T></View>
            ))}
            <T v="caption" color={colors.textMuted}>Photos are reviewed when reported. Accounts using someone else’s photos are removed.</T>
          </View>
        </ScrollView>
      )}
      <PhotoSourceSheet visible={source} onClose={() => setSource(false)} onPick={add} />
      <BottomSheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.main ? 'Main photo' : 'Photo'}>
        {menu && !menu.main && <SheetAction icon="star-outline" label="Make it my main photo" onPress={() => { const m = menu; setMenu(null); run(() => makeMainPhoto(m.path), 'Main photo updated'); }} />}
        <SheetAction icon="trash-outline" label="Delete photo" danger onPress={() => { const m = menu!; setMenu(null); run(() => (m.main ? deleteMainPhoto() : removeGalleryPhoto(m.path)), 'Photo deleted'); }} />
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  slot: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.primarySoft },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#9CC9F5' },
  plus: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  mainTag: { position: 'absolute', left: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(22,138,247,0.92)' },
  mainText: { fontFamily: fonts.semibold, fontSize: 12, color: '#fff' },
  edit: { position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center' },
  card: { padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  tips: { gap: 8, padding: 14, borderRadius: 16, backgroundColor: colors.primarySoft },
});
