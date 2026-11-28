import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { PhotoSourceSheet } from '@/components/PhotoSource';
import { GradientButton, IconButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { createPost, uploadPhoto } from '@/lib/api';
import { pickPhoto, type PhotoSource } from '@/lib/media';
import { friendlyError, photoUrl } from '@/lib/supabase';

export default function MomentNew() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const pick = async (src: PhotoSource) => {
    try { const img = await pickPhoto(src); if (!img) return; setUploading(true); setMedia(await uploadPhoto(img.uri, img.mime, 'post')); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setUploading(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={[s.head, { paddingTop: insets.top + 6 }]}>
        <IconButton name="close" label={t('common.cancel')} onPress={() => router.back()} />
        <Text style={s.title}>{t('moments.new')}</Text>
        <View style={{ width: 42 }} />
      </View>
      <View style={{ padding: 20, gap: 14, flex: 1 }}>
        <TextInput value={body} onChangeText={setBody} placeholder={t('moments.placeholder')} placeholderTextColor={colors.textMuted} multiline maxLength={1000} style={s.input} autoFocus />
        {media ? (
          <View><Image source={{ uri: photoUrl(media) }} style={s.img} contentFit="cover" /><Pressable onPress={() => setMedia(null)} style={s.remove}><Ionicons name="close" size={18} color="#fff" /></Pressable></View>
        ) : (
          <Pressable onPress={() => setSheet(true)} style={s.add}>{uploading ? <ActivityIndicator /> : <><Ionicons name="image-outline" size={22} color={colors.text} /><Text style={s.addText}>📷</Text></>}</Pressable>
        )}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 12 }}>
        <GradientButton label={t('moments.publish')} loading={busy} disabled={!body.trim() && !media}
          onPress={async () => { setBusy(true); try { await createPost(body, media); router.back(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); } }} />
      </View>
      <PhotoSourceSheet visible={sheet} onClose={() => setSheet(false)} onPick={pick} />
    </View>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  input: { minHeight: 120, fontFamily: fonts.regular, fontSize: 17, color: colors.text, textAlignVertical: 'top' },
  img: { width: '100%', aspectRatio: 0.8, borderRadius: 18 },
  remove: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 90, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
  addText: { fontSize: 18 },
});
