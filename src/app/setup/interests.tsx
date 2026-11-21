import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, T } from '@/components/ui';
import { INTERESTS } from '@/constants/content';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { updateMyProfile } from '@/services/api';
import { haptic } from '@/utils/format';

function InterestCard({ item, selected, onPress, width, index }: { item: (typeof INTERESTS)[number]; selected: boolean; onPress: () => void; width: number; index: number }) {
  const a = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(selected ? 1.02 : 1, { damping: 14 }) }] }));
  return (
    <Animated.View entering={FadeInDown.delay(index * 35).springify().damping(18)} style={[{ width }, a]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={item.label}
        onPress={() => { haptic.tap(); onPress(); }} style={[s.card, selected && s.cardOn]}>
        <View style={[s.icon, selected && { backgroundColor: colors.violetDeep }]}>
          <Ionicons name={item.icon} size={20} color={selected ? colors.text : colors.violetSoft} />
        </View>
        <T v="cardTitle" style={{ fontSize: 16 }}>{item.label}</T>
        <T v="caption" color={colors.textMuted} numberOfLines={2}>{item.blurb}</T>
        {selected && <Ionicons name="checkmark-circle" size={20} color={colors.violetSoft} style={{ position: 'absolute', top: 12, right: 12 }} />}
      </Pressable>
    </Animated.View>
  );
}

export default function InterestSelection() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [picked, setPicked] = useState<string[]>(profile?.interests ?? []);
  const [busy, setBusy] = useState(false);
  const cardW = (Math.min(width, 520) - spacing.lg * 2 - 12) / 2;

  const finish = async () => {
    setBusy(true);
    try {
      await updateMyProfile({ interests: picked, onboarding_complete: true });
      haptic.success();
      await refreshProfile();
      router.replace('/discover');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Screen atmosphere edges={['top', 'bottom']}>
      <StackHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 140, gap: spacing.lg }}>
        <View style={{ gap: 6 }}>
          <T v="overline" color={colors.violetSoft}>STEP 2 OF 2</T>
          <T v="screenTitle">What pulls you in?</T>
          <T color={colors.textSecondary}>Choose at least 3. They shape your feed and your Mystery Matches.</T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {INTERESTS.map((it, i) => (
            <InterestCard key={it.slug} item={it} index={i} width={cardW} selected={picked.includes(it.slug)}
              onPress={() => setPicked((p) => (p.includes(it.slug) ? p.filter((x) => x !== it.slug) : [...p, it.slug]))} />
          ))}
        </View>
      </ScrollView>
      <View style={s.footer}>
        <GradientButton label={picked.length < 3 ? `Pick ${3 - picked.length} more` : 'Enter THE UNKNOWN'} disabled={picked.length < 3} loading={busy} onPress={finish} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { minHeight: 132, padding: spacing.md, gap: 6, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
  cardOn: { borderColor: colors.violet, backgroundColor: '#1A1638' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetTint, marginBottom: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: 'rgba(9,11,20,0.94)' },
});
