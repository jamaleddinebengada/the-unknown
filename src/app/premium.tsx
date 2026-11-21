import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora } from '@/components/Effects';
import { Couple, GoldTitle, Sparkle, Star3D } from '@/components/Illustrations3D';
import { useToast } from '@/components/Overlay';
import { GradientButton, IconButton, T } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { buyPlan, getPlusPlans, manageSubscription, restorePlus, subscriptionsAvailable, type PlusPlan } from '@/services/subscriptions';
import { haptic } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;
const BENEFITS: { icon: IconName; title: string; body: string; color: string }[] = [
  { icon: 'planet', title: '10 Mystery Matches a day', body: 'Instead of 1 — meet many more strangers', color: '#7C6CFF' },
  { icon: 'diamond', title: 'PLUS badge on your profile', body: 'Stand out in Discovery and Matches', color: '#F59E0B' },
  { icon: 'sparkles', title: 'Every future PLUS feature', body: 'Included in your subscription as it ships', color: '#EC4899' },
  { icon: 'heart', title: 'Support THE UNKNOWN', body: 'Keep the app independent and ad-light', color: '#10B981' },
];

export default function Premium() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<PlusPlan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(subscriptionsAvailable);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);

  useEffect(() => {
    if (!subscriptionsAvailable) return;
    getPlusPlans()
      .then((p) => { setPlans(p); setSelected(p[0]?.id ?? null); })
      .catch((e) => toast(friendlyError(e), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  /** The server flips is_premium from the store webhook; poll briefly so the UI updates. */
  const waitForServer = async () => {
    for (let i = 0; i < 6; i++) {
      const p = await refreshProfile();
      if (p?.is_premium) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };

  const buy = async () => {
    const plan = plans.find((p) => p.id === selected);
    if (!plan) return;
    setBusy('buy');
    try {
      const ok = await buyPlan(plan);
      if (ok) {
        haptic.success();
        await waitForServer();
        toast('Welcome to UNKNOWN PLUS ✨', 'success');
        router.back();
      }
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      const ok = await restorePlus();
      if (ok) { await waitForServer(); toast('Your UNKNOWN PLUS is restored.', 'success'); }
      else toast('No active subscription found for this store account.');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  const isPlus = !!profile?.is_premium;
  const plan = plans.find((p) => p.id === selected);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora variant="warm" stars={24} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 30, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Close" name="close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))} />
          <View style={{ flex: 1 }} />
          {subscriptionsAvailable && <Pressable onPress={restore} disabled={!!busy} hitSlop={10}><T v="caption" color={colors.violetDeep} style={{ fontFamily: fonts.semibold }}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</T></Pressable>}
        </View>

        <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center' }}>
          <Couple size={Math.min(width * 0.7, 260)} />
        </Animated.View>
        <View style={{ alignItems: 'center' }}>
          <Star3D size={28} style={{ position: 'absolute', right: 20, top: -8 }} />
          <Sparkle size={14} style={{ position: 'absolute', left: 26, top: 6 }} />
          <GoldTitle lines={['UNKNOWN PLUS']} size={Math.min(38, width / 9)} width={width - 32} />
          <T style={{ fontFamily: fonts.display, fontSize: 20, textAlign: 'center' }}>Discover more. Connect deeper.</T>
        </View>

        {isPlus && (
          <Animated.View entering={FadeInDown} style={[s.activeCard]}>
            <Ionicons name="checkmark-circle" size={26} color={colors.success} />
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: fonts.display, fontSize: 17 }}>You are UNKNOWN PLUS ✨</T>
              <T v="caption" color={colors.textSecondary}>Thank you for supporting THE UNKNOWN.</T>
            </View>
            {subscriptionsAvailable && <Pressable onPress={() => manageSubscription().catch(() => {})}><T v="caption" color={colors.violetDeep} style={{ fontFamily: fonts.semibold }}>Manage</T></Pressable>}
          </Animated.View>
        )}

        <View style={{ gap: 10 }}>
          {BENEFITS.map((b, i) => (
            <Animated.View key={b.title} entering={FadeInDown.delay(80 + i * 50).springify().damping(18)} style={s.benefit}>
              <View style={[s.benefitIcon, { backgroundColor: b.color }]}><Ionicons name={b.icon} size={19} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: fonts.display, fontSize: 15.5 }}>{b.title}</T>
                <T v="caption" color={colors.textSecondary}>{b.body}</T>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            </Animated.View>
          ))}
        </View>

        <View style={s.freeNote}>
          <Ionicons name="shield-checkmark" size={18} color={colors.success} />
          <T v="caption" color={colors.textSecondary} style={{ flex: 1 }}>Blocking, reporting, privacy and safety stay free for everyone, always.</T>
        </View>

        {!isPlus && (
          loading ? <ActivityIndicator color={colors.violet} style={{ marginVertical: spacing.lg }} /> :
          plans.length > 0 ? (
            <Animated.View entering={FadeInUp.springify()} style={{ gap: 10 }}>
              {plans.map((p) => {
                const on = p.id === selected;
                return (
                  <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.tap(); setSelected(p.id); }}
                    style={[s.plan, on && s.planOn]}>
                    {p.kind === 'annual' && (
                      <LinearGradient colors={['#F59E0B', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.bestValue}>
                        <T style={{ fontFamily: fonts.display, fontSize: 11.5 }} color={colors.white}>BEST VALUE</T>
                      </LinearGradient>
                    )}
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={24} color={on ? colors.violetDeep : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <T style={{ fontFamily: fonts.display, fontSize: 18 }}>{p.title}</T>
                      <T v="caption" color={colors.textSecondary}>{p.trial ? `${p.trial}, then ` : ''}{p.price}{p.kind === 'annual' ? ' / year' : p.kind === 'monthly' ? ' / month' : ''}</T>
                    </View>
                    {p.perMonth && <T style={{ fontFamily: fonts.display, fontSize: 14 }} color={colors.violetDeep}>≈ {p.perMonth}/mo</T>}
                  </Pressable>
                );
              })}
              <GradientButton label="Unlock UNKNOWN PLUS" icon="sparkles" loading={busy === 'buy'} disabled={!plan || !!busy} onPress={buy} />
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
                {plan ? `${plan.price} ${plan.kind === 'annual' ? 'per year' : 'per month'}` : ''}, billed through {`your ${process.env.EXPO_OS === 'ios' ? 'App Store' : 'Google Play'} account`}. Renews automatically until you cancel — cancel anytime in your store settings, at least 24 hours before renewal.
              </T>
            </Animated.View>
          ) : (
            <View style={s.soon}>
              <T style={{ fontFamily: fonts.display, fontSize: 17, textAlign: 'center' }}>Subscriptions open soon</T>
              <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                UNKNOWN PLUS will be available here as soon as the app is published on Google Play. Nothing will be charged before then.
              </T>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  benefitIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  freeNote: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, paddingTop: spacing.md + 4, borderRadius: 22, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.surfaceBorder },
  planOn: { borderColor: colors.violetDeep, shadowColor: colors.violet, shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  bestValue: { position: 'absolute', top: -11, right: 16, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  activeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: 22, backgroundColor: 'rgba(52,211,153,0.1)', borderWidth: 1.5, borderColor: 'rgba(52,211,153,0.5)' },
  soon: { gap: 6, padding: spacing.lg, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.surfaceBorder },
});
