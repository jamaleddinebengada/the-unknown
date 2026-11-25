import { t } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { BottomSheet, SheetAction, useToast } from '@/components/Overlay';
import { PostCard } from '@/components/PostCard';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, GradientButton, IconButton, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { TIER_LABEL, usePlan } from '@/features/membership/usePlan';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { usePaged } from '@/hooks/usePaged';
import { friendlyError } from '@/lib/supabase';
import { getMyChallenges, getUserPosts } from '@/services/api';
import { addGalleryPhoto, getMyPhotos, removeGalleryPhoto, removeProfilePhoto, setProfilePhoto, type MyPhotos } from '@/services/photos';
import type { ChallengeState, FeedPost } from '@/types/models';
import { ageFromDate, haptic, unknownName } from '@/utils/format';

const VIS_LABEL = { public: 'Everyone can see your photos', revealed: 'Photos visible only after a mutual reveal', hidden: 'Photos hidden from everyone' } as const;

function Shortcut({ icon, label, onPress, gold }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; gold?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic.tap(); onPress(); }} style={s.short}>
      <View style={[s.shortIcon, gold && { backgroundColor: '#FFF4DD' }]}><Ionicons name={icon} size={20} color={gold ? colors.gold : colors.violet} /></View>
      <Text style={s.shortText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>
    </Pressable>
  );
}

export default function MyProfile() {
  const router = useRouter();
  const toast = useToast();
  const plan = usePlan();
  const { profile, refreshProfile, session, resetIdentity } = useAuth();
  const n = profile?.unknown_number ?? 0;
  const posts = usePaged<FeedPost>((o) => getUserPosts(n, o), String(n));
  const [xp, setXp] = useState<ChallengeState | null>(null);
  const [photos, setPhotos] = useState<MyPhotos | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const loadPhotos = useCallback(() => { getMyPhotos().then(setPhotos).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { getMyChallenges().then(setXp).catch(() => {}); loadPhotos(); }, [loadPhotos]));

  if (!profile) return <Screen><ErrorState message="Your anonymous identity is still connecting." onRetry={() => { (session ? refreshProfile() : resetIdentity()); }} /></Screen>;

  const pick = async (aspect: [number, number]) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.82, allowsEditing: true, aspect });
    return !res.canceled && res.assets[0] ? { uri: res.assets[0].uri, mime: res.assets[0].mimeType ?? 'image/jpeg' } : null;
  };
  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    try { await fn(); loadPhotos(); haptic.success(); toast(done, 'success'); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };
  const changePhoto = async () => {
    setPhotoMenu(false);
    const img = await pick([4, 5]);
    if (img) run(() => setProfilePhoto(img.uri, img.mime), 'Profile photo updated');
  };
  const addToGallery = async () => {
    const img = await pick([1, 1]);
    if (img) run(() => addGalleryPhoto(img.uri, img.mime), 'Added to your gallery');
  };
  const galleryOptions = (path: string) => {
    Alert.alert('Gallery photo', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(() => removeGalleryPhoto(path), 'Photo removed') },
    ]);
  };

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={s.title}>Profile</T>
        <View style={{ flex: 1 }} />
        <IconButton label="Share profile" name="share-outline" onPress={() => Share.share({ message: `Find me on THE UNKNOWN as ${unknownName(n)}` }).catch(() => {})} />
        <IconButton label="Settings" name="settings-outline" onPress={() => router.push('/settings')} />
      </View>
      <ProfileHeader number={n} seed={profile.avatar_seed} country={profile.country_code}
        age={profile.birth_date ? String(ageFromDate(profile.birth_date)) : null} interests={profile.interests} tags={profile.personality_tags}
        tagline={profile.tagline} theme={profile.profile_theme} scrollY={scrollY} displayName={profile.display_name}
        photoUrlOverride={photos ? photos.photoUrl : undefined}
        galleryOverride={photos ? photos.gallery.map((p, i) => ({ path: p, url: photos.galleryUrls[i] })).filter((g) => g.url) : []}
        onPhotoPress={() => setPhotoMenu(true)} onAddGalleryPhoto={addToGallery} onGalleryPress={(p) => galleryOptions(p)}
        stats={[
          { label: 'Posts', value: posts.items.length + (posts.done ? '' : '+') },
          { label: 'Level', value: xp?.level ?? 1 },
          { label: 'Points', value: xp?.xp ?? 0 },
        ]}
        footer={<GradientButton icon="create-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} style={{ marginTop: 10 }} />} />
      {busy && <ActivityIndicator color={colors.violet} />}
      <Pressable onPress={() => router.push('/privacy')} style={s.vis} accessibilityRole="button">
        <Ionicons name={profile.photo_visibility === 'public' ? 'eye-outline' : profile.photo_visibility === 'hidden' ? 'eye-off-outline' : 'lock-closed-outline'} size={18} color={colors.violet} />
        <T v="caption" color={colors.textSecondary} style={{ flex: 1 }}>{VIS_LABEL[profile.photo_visibility ?? 'revealed']}</T>
        <T v="caption" color={colors.violetDeep} style={{ fontFamily: fonts.semibold }}>Change</T>
      </Pressable>
      <View style={s.shortcuts}>
        <Shortcut icon="eye-outline" label="Visitors" onPress={() => router.push('/visitors')} />
        <Shortcut icon="star-outline" label="Favorites" onPress={() => router.push('/favorites')} />
        <Shortcut icon="trophy-outline" label="Challenges" onPress={() => router.push('/challenges')} />
        <Shortcut icon="diamond-outline" label={plan && plan.tier !== 'free' ? TIER_LABEL[plan.tier] : 'Premium'} gold onPress={() => router.push('/premium')} />
      </View>
      <View style={s.shortcuts}>
        <Shortcut icon="wallet-outline" label={t('profile.wallet')} onPress={() => router.push('/wallet')} />
        <Shortcut icon={profile.is_verified ? 'checkmark-circle' : 'checkmark-circle-outline'} label={t('profile.verify')} onPress={() => router.push('/verify')} />
        <Shortcut icon="shield-outline" label={t('profile.account')} onPress={() => router.push('/account')} />
        <Shortcut icon="globe-outline" label={t('profile.language')} onPress={() => router.push('/language')} />
      </View>
      {profile.is_admin && (
        <Pressable onPress={() => router.push('/admin')} style={s.vis} accessibilityRole="button">
          <Ionicons name="hammer-outline" size={18} color={colors.primary} />
          <T v="caption" color={colors.text} style={{ flex: 1, fontFamily: fonts.semibold }}>{t('profile.admin')}</T>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      )}
      <T v="section" style={{ marginTop: spacing.sm }}>Your posts</T>
    </View>
  );

  return (
    <Screen>
      <Animated.FlatList data={posts.items} onScroll={onScroll} scrollEventThrottle={16} keyExtractor={(p) => p.id} ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 130 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item, index }) => <PostCard post={item} index={index} onChange={posts.update} onRemoved={posts.remove} />}
        onEndReached={posts.loadMore}
        refreshControl={<RefreshControl refreshing={posts.refreshing} onRefresh={() => { refreshProfile(); loadPhotos(); posts.refresh(); }} tintColor={colors.violet} />}
        ListEmptyComponent={posts.loading ? <ActivityIndicator color={colors.violet} /> :
          <EmptyState icon="create-outline" title="Your story starts here" body="Share a thought, a question or a secret. Someone, somewhere, may be waiting for it." action="Create a post" onAction={() => router.push('/create')} />} />
      <BottomSheet visible={photoMenu} onClose={() => setPhotoMenu(false)} title="Profile photo">
        <SheetAction icon="image-outline" label={photos?.photoUrl ? 'Change photo' : 'Upload a photo'} onPress={changePhoto} />
        <SheetAction icon="shield-checkmark-outline" label="Who can see my photos" onPress={() => { setPhotoMenu(false); router.push('/privacy'); }} />
        {photos?.photoUrl && <SheetAction icon="trash-outline" label="Remove photo" danger onPress={() => { setPhotoMenu(false); run(removeProfilePhoto, 'Photo removed'); }} />}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, color: colors.text },
  vis: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  shortcuts: { flexDirection: 'row', gap: 10 },
  short: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  shortIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  shortText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
});
