import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaskLogo } from '@/components/Brand';
import { useToast } from '@/components/Overlay';
import { GradientButton, IconButton, T } from '@/components/ui';
import { INTERESTS } from '@/constants/content';
import { interestArt } from '@/constants/interestArt';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { updateMyProfile } from '@/services/api';
import { haptic } from '@/utils/format';

const FIRST = ['travel', 'music', 'gaming', 'sports', 'movies', 'culture', 'education', 'technology', 'dreams'];

function Tile({ slug, on, size, onPress }: { slug: string; on: boolean; size: number; onPress: () => void }) {
  const art = interestArt(slug);
  const label = INTERESTS.find((i) => i.slug === slug)?.label ?? slug;
  const a = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(on ? 1.04 : 1, { damping: 12 }) }] }));
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress}>
      <Animated.View style={[{ width: size, height: size }, a]}>
        <LinearGradient colors={on ? ['#3BA0FF', '#168AF7'] : art.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, on && styles.tileOn]}>
          <Text style={{ fontSize: size * 0.4 }}>{art.emoji}</Text>
          <Text style={[styles.label, on && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{label}</Text>
        </LinearGradient>
        {on && <View style={styles.check}><Ionicons name="checkmark" size={14} color={colors.onPrimary} /></View>}
      </Animated.View>
    </Pressable>
  );
}

/** Choose Your Vibe — interests shape matches and the feed. Optional, saved to the profile. */
export default function Vibe() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, enter, refreshProfile } = useAuth();
  const [all, setAll] = useState(false);
  const [picked, setPicked] = useState<string[]>(profile?.interests?.length ? profile.interests : []);
  const [busy, setBusy] = useState(false);
  const size = Math.floor((width - spacing.xl * 2 - 24) / 3);
  const list = all ? INTERESTS.map((i) => i.slug) : FIRST;

  const toggle = (slug: string) => {
    haptic.tap();
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : p.length >= 8 ? p : [...p, slug]));
  };
  const go = async () => {
    setBusy(true);
    try {
      if (picked.length) { await updateMyProfile({ interests: picked }); await refreshProfile(); }
      haptic.success();
      await enter();
      router.replace('/nearby');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.mystery} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 4, paddingHorizontal: spacing.xl, paddingBottom: 150, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Back" name="chevron-back" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: 'center' }}><MaskLogo size={64} /></View>
          <View style={{ width: 42 }} />
        </View>
        <Animated.View entering={FadeInDown.springify().damping(16)} style={{ alignItems: 'center', gap: 6 }}>
          <Text style={styles.title}>Choose Your Vibe</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Select your interests to get{'\n'}better matches and content.</T>
        </Animated.View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {list.map((slug, i) => (
            <Animated.View key={slug} entering={FadeInDown.delay(60 + i * 35).springify().damping(16)}>
              <Tile slug={slug} on={picked.includes(slug)} size={size} onPress={() => toggle(slug)} />
            </Animated.View>
          ))}
        </View>
        {!all && (
          <Pressable onPress={() => setAll(true)} style={styles.more} accessibilityRole="button">
            <Ionicons name="add" size={18} color={colors.text} /><T style={{ fontFamily: fonts.semibold }}>Add More</T>
          </Pressable>
        )}
        <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>{picked.length}/8 selected · you can change this anytime</T>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <GradientButton label={picked.length ? 'Continue' : 'Skip for now'} arrow loading={busy} onPress={go} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.6, color: colors.text },
  tile: { flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  tileOn: { borderColor: colors.text, borderWidth: 2 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  check: { position: 'absolute', top: -5, right: -5, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  more: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, paddingTop: 12, backgroundColor: 'rgba(248,250,252,0.94)' },
});
