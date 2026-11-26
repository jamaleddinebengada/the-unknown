import { t } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { PostCard } from '@/components/PostCard';
import { Screen } from '@/components/Screen';
import { EmptyState, ErrorState, GradientButton, IconButton, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { TIER_LABEL, usePlan } from '@/features/membership/usePlan';
import { ProfileHeader } from '@/features/profile/ProfileHeader';
import { usePaged } from '@/hooks/usePaged';
import { getMyChallenges, getUserPosts } from '@/services/api';
import { getMyPhotos, type MyPhotos } from '@/services/photos';
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
  const plan = usePlan();
  const { profile, refreshProfile, session, resetIdentity } = useAuth();
  const n = profile?.unknown_number ?? 0;
  const posts = usePaged<FeedPost>((o) => getUserPosts(n, o), String(n));
  const [xp, setXp] = useState<ChallengeState | null>(null);
  const [photos, setPhotos] = useState<MyPhotos | null>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });

  const loadPhotos = useCallback(() => { getMyPhotos().then(setPhotos).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { getMyChallenges().then(setXp).catch(() => {}); loadPhotos(); }, [loadPhotos]));

  if (!profile) return <Screen><ErrorState message="Your anonymous identity is still connecting." onRetry={() => { (session ? refreshProfile() : resetIdentity()); }} /></Screen>;

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
        onPhotoPress={() => router.push('/photos')} onAddGalleryPhoto={() => router.push('/photos')} onGalleryPress={() => router.push('/photos')}
        stats={[
          { label: 'Posts', value: posts.items.length + (posts.done ? '' : '+') },
          { label: 'Level', value: xp?.level ?? 1 },
          { label: 'Points', value: xp?.xp ?? 0 },
        ]}
        footer={<GradientButton icon="create-outline" label="Edit Profile" onPress={() => router.push('/edit-profile')} style={{ marginTop: 10 }} />} />
      {(!photos?.photoUrl || !profile.display_name) && (
        <Pressable onPress={() => router.push(photos?.photoUrl ? '/edit-profile' : '/photos')} style={s.nudge} accessibilityRole="button">
          <View style={s.nudgeIcon}><Ionicons name={photos?.photoUrl ? 'person-outline' : 'camera'} size={20} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.nudgeTitle}>{photos?.photoUrl ? 'Choose your display name' : 'Add your photos'}</Text>
            <T v="caption" color={colors.textMuted}>{photos?.photoUrl ? 'People will see your name instead of a number.' : 'Profiles with a photo get many more replies. Up to 6 photos.'}</T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      )}
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
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, color: colors.text },
  vis: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  shortcuts: { flexDirection: 'row', gap: 10 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.primarySoft },
  nudgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nudgeTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  short: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  shortIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  shortText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text },
});
