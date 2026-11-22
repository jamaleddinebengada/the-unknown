import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeartBurst } from '@/components/Effects';
import { useToast } from '@/components/Overlay';
import { Scenery } from '@/components/Scenery';
import { GradientButton, IconButton, T } from '@/components/ui';
import { colors, fonts, gradients, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { refreshPlan, TIER_LABEL, usePlan } from '@/features/membership/usePlan';
import { friendlyError } from '@/lib/supabase';
import {
  buyPlan, getStorePlans, LIST_PRICES, manageSubscription, restorePurchases, subscriptionsAvailable, YEARLY_SAVING,
  type Billing, type PaidTier, type StorePlan,
} from '@/services/subscriptions';
import { haptic } from '@/utils/format';

type TierKey = 'free' | PaidTier;
const FEATURES: Record<TierKey, string[]> = {
  free: ['Feed & posting', '1 Mystery Match a day', '20 AI messages a day', 'Nearby up to 25 km', 'All safety tools'],
  plus: ['10 matches a day', 'Advanced filters', '100 AI messages a day', 'Nearby up to 100 km', 'Save favorites', 'Plus badge'],
  vip: ['All Plus features', '25 matches a day', '300 AI messages a day', 'Priority in Discover', '3 Super Connects / day', 'Exclusive themes', 'VIP badge'],
};
const ORDER: TierKey[] = ['free', 'plus', 'vip'];

function Crown({ size = 46 }: { size?: number }) {
  return <Text style={{ fontSize: size, lineHeight: size * 1.15 }}>👑</Text>;
}

function TierCard({ tier, selected, current, price, period, onPress, live }: {
  tier: TierKey; selected: boolean; current: boolean; price: string; period: string; onPress: () => void; live: boolean;
}) {
  const vip = tier === 'vip';
  const plus = tier === 'plus';
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${TIER_LABEL[tier]} ${price}`}
      onPress={onPress} style={[{ flex: 1 }, selected && { transform: [{ translateY: -4 }] }]}>
      {plus && <View style={s.popular}><LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.popularIn}><Text style={s.popularText}>Most Popular</Text></LinearGradient></View>}
      {vip && <View style={s.crownTop}><Text style={{ fontSize: 22 }}>👑</Text></View>}
      <LinearGradient
        colors={vip ? ['#FFFBEA', '#FFF1B8'] : plus ? ['#FFFBEA', '#FFF6D6'] : ['#FFFFFF', '#FFFBF8']}
        style={[s.tier, selected && { borderColor: vip ? colors.gold : colors.violet, borderWidth: 2 }, selected && s.tierShadow]}>
        <Text style={[s.tierName, vip && { color: '#7A5600' }, plus && { color: colors.violetDeep }]}>{TIER_LABEL[tier]}</Text>
        <Text adjustsFontSizeToFit numberOfLines={1} style={[s.tierPrice, vip && { color: '#7A5600' }, plus && { color: colors.violetDeep }]}>{price}</Text>
        <Text style={s.tierPeriod}>{period}{tier !== 'free' && !live ? ' · planned' : ''}</Text>
        <View style={{ gap: 7, marginTop: 10 }}>
          {FEATURES[tier].map((f) => (
            <View key={f} style={{ flexDirection: 'row', gap: 5 }}>
              <Ionicons name="checkmark-circle" size={13} color={vip ? colors.gold : colors.coral} style={{ marginTop: 1 }} />
              <Text style={s.feature}>{f}</Text>
            </View>
          ))}
        </View>
        {current && <View style={s.current}><Text style={s.currentText}>Current</Text></View>}
      </LinearGradient>
    </Pressable>
  );
}

/** Premium purchase confirmation: crown + hearts burst. */
function Celebration({ tier, onDone }: { tier: PaidTier | null; onDone: () => void }) {
  return (
    <Modal visible={!!tier} transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={s.celebrateBg} onPress={onDone}>
        <Animated.View entering={ZoomIn.springify().damping(11)} style={s.celebrateCard}>
          <HeartBurst trigger={tier ? 1 : 0} size={140} />
          <Crown size={64} />
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.plum }}>Welcome to {tier ? TIER_LABEL[tier] : ''}</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Your new benefits are active. Thank you for supporting THE UNKNOWN.</T>
          <GradientButton label="Continue" arrow onPress={onDone} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function Premium() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { refreshProfile } = useAuth();
  const plan = usePlan();
  const currentTier: TierKey = plan?.tier ?? 'free';
  const [billing, setBilling] = useState<Billing>('monthly');
  const [selected, setSelected] = useState<TierKey>('plus');
  const [store, setStore] = useState<StorePlan[]>([]);
  const [loading, setLoading] = useState(subscriptionsAvailable);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [celebrate, setCelebrate] = useState<PaidTier | null>(null);

  useEffect(() => {
    if (!subscriptionsAvailable) return;
    getStorePlans().then(setStore).catch((e) => toast(friendlyError(e), 'error')).finally(() => setLoading(false));
  }, [toast]);
  useEffect(() => { if (currentTier !== 'free') setSelected('vip'); }, [currentTier]);

  const storePlan = (t: TierKey) => (t === 'free' ? undefined : store.find((p) => p.tier === t && p.billing === billing));
  const priceOf = (t: TierKey) => (t === 'free' ? '0 DH' : storePlan(t)?.price ?? LIST_PRICES[t][billing]);
  const chosen = storePlan(selected);
  const ready = subscriptionsAvailable && !loading && !!chosen;

  /** The webhook updates the tier on the server; poll briefly so the screen reflects it. */
  const waitForServer = async (want: TierKey) => {
    for (let i = 0; i < 8; i++) {
      const p = await refreshPlan();
      if (p?.tier === want) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    await refreshProfile();
  };

  const buy = async () => {
    if (!chosen) return;
    setBusy('buy');
    try {
      if (await buyPlan(chosen)) { haptic.success(); await waitForServer(chosen.tier); setCelebrate(chosen.tier); }
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const restore = async () => {
    setBusy('restore');
    try {
      const t = await restorePurchases();
      if (t !== 'free') { await waitForServer(t); toast(`Your ${TIER_LABEL[t]} membership is restored.`, 'success'); }
      else toast('No active membership found for this store account.');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  const cta = useMemo(() => {
    if (selected === 'free') return currentTier === 'free' ? 'You are on Free' : 'Manage or cancel in your store';
    if (selected === currentTier) return 'Your current plan';
    if (currentTier === 'vip' && selected === 'plus') return 'Switch to Plus';
    if (currentTier !== 'free') return `Upgrade to ${TIER_LABEL[selected]}`;
    return `Upgrade to ${TIER_LABEL[selected]}`;
  }, [selected, currentTier]);

  const onCta = () => {
    if (selected === 'free') { if (currentTier !== 'free') manageSubscription().catch(() => {}); return; }
    if (selected === currentTier) { manageSubscription().catch(() => {}); return; }
    buy();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.mystery} style={StyleSheet.absoluteFill} />
      <Scenery width={width} height={170} backdrop={false} flowers="both" style={{ position: 'absolute', top: 0, opacity: 0.7 }} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 4, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 30, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Close" name="close" onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))} />
          <View style={{ flex: 1 }} />
          {subscriptionsAvailable && <Pressable onPress={restore} disabled={!!busy} hitSlop={10}><T v="caption" color={colors.violetDeep} style={{ fontFamily: fonts.semibold }}>{busy === 'restore' ? 'Restoring…' : 'Restore purchases'}</T></Pressable>}
        </View>

        <Animated.View entering={FadeInDown.springify().damping(16)} style={{ alignItems: 'center', gap: 2 }}>
          <Crown />
          <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: colors.plum, letterSpacing: 1 }}>THE UNKNOWN</Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 48, color: colors.violetDeep }}>Premium</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center', marginTop: 4 }}>Unlock the full experience{'\n'}and go beyond the unknown.</T>
        </Animated.View>

        {currentTier !== 'free' && plan && (
          <Animated.View entering={FadeIn} style={s.status}>
            <Text style={{ fontSize: 22 }}>{currentTier === 'vip' ? '👑' : '✨'}</Text>
            <View style={{ flex: 1 }}>
              <T style={{ fontFamily: fonts.bold }}>You are {TIER_LABEL[currentTier]}</T>
              <T v="caption" color={colors.textSecondary}>
                {plan.sub_status === 'cancelled' ? 'Cancelled — access until ' : 'Renews '}
                {plan.renews_at ? new Date(plan.renews_at).toLocaleDateString() : 'automatically'}
              </T>
            </View>
            {subscriptionsAvailable && <Pressable onPress={() => manageSubscription().catch(() => {})} hitSlop={8}><T v="caption" color={colors.violetDeep} style={{ fontFamily: fonts.semibold }}>Manage</T></Pressable>}
          </Animated.View>
        )}

        <Animated.View entering={FadeInUp.delay(80).springify()} style={{ flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'stretch' }}>
          {ORDER.map((t) => (
            <TierCard key={t} tier={t} selected={selected === t} current={currentTier === t} price={priceOf(t)}
              period={t === 'free' ? 'forever' : billing === 'yearly' ? '/year' : '/month'}
              live={!!storePlan(t)} onPress={() => { haptic.tap(); setSelected(t); }} />
          ))}
        </Animated.View>

        <View style={s.toggle}>
          {(['monthly', 'yearly'] as Billing[]).map((b) => (
            <Pressable key={b} accessibilityRole="radio" accessibilityState={{ checked: billing === b }} onPress={() => { haptic.tap(); setBilling(b); }} style={s.toggleItem}>
              {billing === b && <View style={s.toggleOn} />}
              <Text style={[s.toggleText, billing === b && { color: colors.violetDeep }]}>{b === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
            </Pressable>
          ))}
          <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.save}><Text style={s.saveText}>Save {YEARLY_SAVING}</Text></LinearGradient>
        </View>

        {loading ? <ActivityIndicator color={colors.violet} /> : (
          <GradientButton icon="diamond" label={ready || selected === 'free' || selected === currentTier ? cta : 'Coming soon on Google Play'}
            disabled={selected === 'free' ? currentTier === 'free' : selected !== currentTier && !ready} loading={busy === 'buy'} arrow={ready} onPress={onCta} />
        )}

        <View style={s.trust}>
          <View style={s.trustItem}><Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} /><T v="caption" color={colors.textSecondary}>Secure Payment</T></View>
          <View style={s.trustItem}><Ionicons name="refresh-outline" size={14} color={colors.textSecondary} /><T v="caption" color={colors.textSecondary}>Cancel Anytime</T></View>
          {chosen?.trial && <View style={s.trustItem}><Ionicons name="time-outline" size={14} color={colors.textSecondary} /><T v="caption" color={colors.textSecondary}>{chosen.trial}</T></View>}
        </View>

        <T v="caption" color={colors.textMuted} style={{ textAlign: 'center', lineHeight: 18 }}>
          {ready
            ? `${chosen!.price} ${billing === 'yearly' ? 'per year' : 'per month'}, billed to your ${process.env.EXPO_OS === 'ios' ? 'App Store' : 'Google Play'} account. Your membership renews automatically until you cancel; cancel at least 24 hours before the renewal date in your store's subscription settings. Upgrades take effect right away; downgrades apply at the next renewal.`
            : 'Planned prices. Memberships open when THE UNKNOWN is published on Google Play — the final price is the one Google Play shows at checkout. Nothing is charged before then.'}
        </T>
        <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>Blocking, reporting and every safety control stay free for everyone.</T>
      </ScrollView>
      <Celebration tier={celebrate} onDone={() => { setCelebrate(null); router.back(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  tier: { flex: 1, borderRadius: 20, paddingHorizontal: 10, paddingTop: 22, paddingBottom: 14, borderWidth: 1, borderColor: colors.surfaceBorder, minHeight: 250 },
  tierShadow: { shadowColor: '#25324A', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  tierName: { fontFamily: fonts.serif, fontSize: 21, color: colors.text, textAlign: 'center' },
  tierPrice: { fontFamily: fonts.bold, fontSize: 21, color: colors.text, textAlign: 'center', marginTop: 6 },
  tierPeriod: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted, textAlign: 'center' },
  feature: { flex: 1, fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.textSecondary },
  popular: { position: 'absolute', top: -12, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  popularIn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  popularText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.onPrimary },
  crownTop: { position: 'absolute', top: -16, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  current: { marginTop: 'auto', alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(47,191,138,0.14)' },
  currentText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.success },
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', padding: 4, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, gap: 2 },
  toggleItem: { height: 36, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  toggleOn: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: colors.blush },
  toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  save: { paddingHorizontal: 12, height: 32, borderRadius: radius.pill, justifyContent: 'center', marginLeft: 4 },
  saveText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.onPrimary },
  trust: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.goldSoft },
  celebrateBg: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  celebrateCard: { width: '100%', maxWidth: 360, alignItems: 'center', gap: 8, padding: spacing.xl, borderRadius: 28, backgroundColor: colors.ivory },
});
