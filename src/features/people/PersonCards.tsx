import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { MaskAvatar } from '@/components/PersonAvatar';
import { useToast } from '@/components/Overlay';
import { interestLabel } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts } from '@/constants/theme';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { friendlyError } from '@/lib/supabase';
import { connectWith, toggleFavorite } from '@/services/api';
import type { PersonCard } from '@/types/models';
import { haptic } from '@/utils/format';

export const nameOf = (p: Pick<PersonCard, 'display_name' | 'unknown_number'>) => p.display_name?.trim() || `UNKNOWN #${p.unknown_number}`;
export const placeOf = (p: PersonCard) =>
  [p.distance_band, p.city ?? (p.country_code ? countryName(p.country_code) : null)].filter(Boolean).join(' · ') || (p.country_code ? `${flagOf(p.country_code)}` : 'Location hidden');

/** Shared actions: favorite + "say hi" (a connection request; the chat opens when they accept). */
export function usePersonActions(onChange?: (p: PersonCard) => void) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const favorite = useCallback(async (p: PersonCard) => {
    haptic.tap();
    try { const on = await toggleFavorite(p.unknown_number); onChange?.({ ...p, is_favorite: on }); toast(on ? 'Added to favorites' : 'Removed from favorites', 'success'); }
    catch (e) { toast(friendlyError(e), 'error'); }
  }, [onChange, toast]);
  const sayHi = useCallback(async (p: PersonCard) => {
    setBusy(`hi${p.unknown_number}`);
    try {
      const m = await connectWith(p.unknown_number);
      haptic.success();
      if (m?.conversation_id) router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } });
      else toast(m?.they_accepted ? 'They already said yes — check Messages.' : `Request sent to ${nameOf(p)}. The chat opens when they accept.`, 'success');
    } catch (e) {
      toast(friendlyError(e), 'error');
      if (String((e as Error)?.message).includes('daily_limit_reached')) router.push('/premium');
    } finally { setBusy(null); }
  }, [router, toast]);
  return { favorite, sayHi, busy };
}

/** Large photo of a member, or a clean placeholder. Photos only load when the member allows it. */
export const PersonPhoto = memo(function PersonPhoto({ p, width, height, radius = 16 }: { p: PersonCard; width: number; height: number; radius?: number }) {
  const meta = usePersonMeta(p.has_photo ? p.unknown_number : null);
  const url = meta?.photoUrl;
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.bgSecondary }}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessibilityLabel={`${nameOf(p)}'s photo`} /> : (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <MaskAvatar seed={p.avatar_seed} size={Math.min(width, height) * 0.5} name={p.display_name} />
        </View>
      )}
    </View>
  );
});

function Badges({ p }: { p: PersonCard }) {
  return (
    <View style={s.badges}>
      {p.online && <View style={s.onlinePill}><View style={s.dot} /><Text style={s.badgeText}>Online</Text></View>}
      {!p.online && p.is_new && <View style={[s.onlinePill, { backgroundColor: colors.primary }]}><Text style={[s.badgeText, { color: colors.white }]}>New</Text></View>}
      {p.tier === 'vip' && <View style={[s.onlinePill, { backgroundColor: colors.vip }]}><Ionicons name="diamond" size={10} color="#5A4000" /><Text style={[s.badgeText, { color: '#5A4000' }]}>SVIP</Text></View>}
      {p.tier === 'plus' && <View style={[s.onlinePill, { backgroundColor: colors.vip }]}><Ionicons name="diamond-outline" size={10} color="#5A4000" /><Text style={[s.badgeText, { color: '#5A4000' }]}>VIP</Text></View>}
    </View>
  );
}

function HeartButton({ on, onPress, size = 34 }: { on: boolean; onPress: () => void; size?: number }) {
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={on ? 'Remove from favorites' : 'Add to favorites'} hitSlop={6}
      onPress={() => { sc.set(withSequence(withSpring(1.3, { damping: 6 }), withSpring(1))); onPress(); }}
      style={[s.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View style={a}><Ionicons name={on ? 'heart' : 'heart-outline'} size={size * 0.52} color={colors.coral} /></Animated.View>
    </Pressable>
  );
}

/** Grid card: large photo, name & age, approximate place, favorite + say hi. */
export const PersonTile = memo(function PersonTile({ p, width, onOpen, onFavorite, onSayHi, busy }: {
  p: PersonCard; width: number; onOpen: () => void; onFavorite: () => void; onSayHi: () => void; busy?: boolean;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${nameOf(p)}${p.age ? `, ${p.age}` : ''}`} style={({ pressed }) => [s.tile, { width }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <View>
        <PersonPhoto p={p} width={width} height={width * 1.28} radius={0} />
        <Badges p={p} />
      </View>
      <View style={s.tileInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text numberOfLines={1} style={s.name}>{nameOf(p)}{p.age ? `, ${p.age}` : ''}</Text>
          {p.is_verified && <Ionicons name="checkmark-circle" size={15} color={colors.primary} />}
        </View>
        <Text numberOfLines={1} style={s.place}>{placeOf(p)}</Text>
        <View style={s.tileActions}>
          <HeartButton on={p.is_favorite} onPress={onFavorite} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Say hi to ${nameOf(p)}`} onPress={onSayHi} disabled={busy} style={s.hiBtn}>
            {busy ? <ActivityIndicator size="small" color={colors.white} /> : <><Ionicons name="chatbubble-ellipses" size={14} color={colors.white} /><Text style={s.hiText}>Say hi</Text></>}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

/** List row: avatar, name, place, shared interests, actions. */
export const PersonRow = memo(function PersonRow({ p, onOpen, onFavorite, onSayHi, busy }: {
  p: PersonCard; onOpen: () => void; onFavorite: () => void; onSayHi: () => void; busy?: boolean;
}) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.bgSecondary }]}>
      <View>
        <PersonPhoto p={p} width={64} height={64} radius={32} />
        {p.online && <View style={s.rowDot} />}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text numberOfLines={1} style={[s.name, { flexShrink: 1 }]}>{nameOf(p)}{p.age ? `, ${p.age}` : ''}</Text>
          {p.is_verified && <Ionicons name="checkmark-circle" size={15} color={colors.primary} />}
          {p.tier !== 'free' && <Ionicons name="diamond" size={13} color={colors.vip} />}
        </View>
        <Text numberOfLines={1} style={s.place}>{placeOf(p)}</Text>
        {(p.shared_interests.length > 0 || p.interests.length > 0) && (
          <Text numberOfLines={1} style={[s.place, { color: colors.primary }]}>
            {(p.shared_interests.length ? p.shared_interests : p.interests).slice(0, 3).map(interestLabel).join(' · ')}
          </Text>
        )}
      </View>
      <HeartButton on={p.is_favorite} onPress={onFavorite} size={38} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Say hi to ${nameOf(p)}`} onPress={onSayHi} disabled={busy} style={[s.iconBtn, { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary }]}>
        {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name="chatbubble-ellipses" size={18} color={colors.white} />}
      </Pressable>
    </Pressable>
  );
});

const s = StyleSheet.create({
  tile: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  tileInfo: { padding: 10, gap: 2 },
  tileActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  place: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  badges: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.online },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.text },
  iconBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.coralSoft },
  hiBtn: { flex: 1, height: 34, borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.primary },
  hiText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.white },
  rowDot: { position: 'absolute', right: 2, bottom: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.online, borderWidth: 2, borderColor: colors.white },
});
