import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, T } from '@/components/ui';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { buyBoost, getReceivedGifts, getWallet, type Wallet } from '@/services/api';
import { buyCoins, getCoinPacks, restorePurchases, subscriptionsAvailable, type CoinPack } from '@/services/subscriptions';
import { t, type TKey } from '@/i18n';
import { haptic } from '@/utils/format';

/** Coins (server-side balance), coin packs with real Google Play prices, Boost and received gifts. */
export default function WalletScreen() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [packs, setPacks] = useState<CoinPack[] | null>(null);
  const [gifts, setGifts] = useState<{ total: number; by_gift: { emoji: string; name: string; count: number }[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const [w, g] = await Promise.all([getWallet(), getReceivedGifts()]);
      setWallet(w); setGifts(g);
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setRefreshing(false); }
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { getCoinPacks().then(setPacks).catch(() => setPacks([])); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const boostLeft = wallet?.boosted_until ? Math.ceil((new Date(wallet.boosted_until).getTime() - now) / 60000) : 0;

  const buy = async (p: CoinPack) => {
    setBusy(p.productId);
    try {
      if (await buyCoins(p)) {
        toast(t('wallet.processing'), 'success');
        // the webhook credits the coins — poll briefly for the new balance
        const before = wallet?.balance ?? 0;
        for (let i = 0; i < 6; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const w = await getWallet(); setWallet(w);
          if (w.balance > before) break;
        }
      }
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const boost = async (free: boolean) => {
    setBusy(free ? 'free' : 'boost');
    try { const r = await buyBoost(free); haptic.success(); toast(t('wallet.boosted'), 'success'); setWallet((w) => w && { ...w, balance: r.balance, boosted_until: r.boosted_until, free_boost_available: free ? false : w.free_boost_available }); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  return (
    <Screen edges={['top']}>
      <StackHeader title={t('wallet.title')} />
      {!wallet ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
          <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Text style={s.heroLabel}>{t('wallet.balance')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={s.coin}><Text style={{ fontSize: 22 }}>🪙</Text></View>
              <Text style={s.balance} accessibilityLabel={`${wallet.balance} coins`}>{wallet.balance.toLocaleString()}</Text>
            </View>
          </LinearGradient>

          <Text style={s.section}>{t('wallet.buy')}</Text>
          {packs === null ? <ActivityIndicator color={colors.primary} /> : packs.length === 0 ? (
            <View style={s.note}><Ionicons name="information-circle-outline" size={20} color={colors.primary} /><T v="caption" style={{ flex: 1 }}>{t('wallet.storeUnavailable')}</T></View>
          ) : (
            <View style={s.grid}>
              {packs.map((p, i) => (
                <Pressable key={p.productId} onPress={() => buy(p)} disabled={!!busy} style={({ pressed }) => [s.pack, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                  {i === 2 && <View style={s.popular}><Text style={s.popularText}>★</Text></View>}
                  <Text style={{ fontSize: 26 }}>🪙</Text>
                  <Text style={s.packCoins}>{p.coins.toLocaleString()}</Text>
                  <View style={s.price}>{busy === p.productId ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Text style={s.priceText}>{p.price}</Text>}</View>
                </Pressable>
              ))}
            </View>
          )}
          {subscriptionsAvailable && <Pressable onPress={async () => { await restorePurchases().catch(() => {}); load(); }} style={{ alignSelf: 'center', padding: 6 }}><Text style={s.link}>{t('wallet.restore')}</Text></Pressable>}

          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <LinearGradient colors={['#B57BFF', '#7C3AED']} style={s.boostIcon}><Ionicons name="flash" size={22} color="#fff" /></LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{t('wallet.boost')}</Text>
                <T v="caption" color={colors.textMuted}>{boostLeft > 0 ? t('wallet.boostActive', { min: boostLeft }) : t('wallet.boostBody')}</T>
              </View>
            </View>
            {boostLeft <= 0 && (wallet.free_boost_available
              ? <GradientButton small icon="flash" label={t('wallet.boostFree')} loading={busy === 'free'} onPress={() => boost(true)} />
              : <GradientButton small icon="flash" label={t('wallet.boostCta')} loading={busy === 'boost'} disabled={wallet.balance < 100} onPress={() => boost(false)} />)}
          </View>

          {!!gifts?.total && (
            <View style={s.card}>
              <Text style={s.cardTitle}>{t('wallet.received')} · {gifts.total}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {gifts.by_gift.map((g) => <View key={g.name} style={s.giftChip}><Text style={{ fontSize: 18 }}>{g.emoji}</Text><Text style={s.giftCount}>×{g.count}</Text></View>)}
              </View>
            </View>
          )}

          <Text style={s.section}>{t('wallet.history')}</Text>
          <View style={s.card}>
            {wallet.history.length === 0 ? <T color={colors.textMuted}>{t('wallet.noHistory')}</T> : wallet.history.map((h, i) => (
              <View key={i} style={[s.hRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.hReason}>{t(`wallet.r.${h.reason}` as TKey)}</Text>
                  <T v="caption" color={colors.textMuted}>{new Date(h.created_at).toLocaleString()}</T>
                </View>
                <Text style={[s.hDelta, { color: h.delta > 0 ? colors.online : h.delta < 0 ? colors.text : colors.textMuted }]}>{h.delta > 0 ? `+${h.delta}` : h.delta}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 20, padding: 20, gap: 8 },
  heroLabel: { fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  coin: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  balance: { fontFamily: fonts.extrabold, fontSize: 40, color: '#fff', letterSpacing: -1 },
  section: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 4 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pack: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 4, paddingTop: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  popular: { position: 'absolute', top: 6, right: 8 },
  popularText: { color: colors.vip, fontSize: 14 },
  packCoins: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  price: { alignSelf: 'stretch', marginTop: 8, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.primary },
  priceText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onPrimary },
  link: { fontFamily: fonts.semibold, color: colors.primary, fontSize: 14 },
  card: { gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  boostIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  giftChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.primarySoft },
  giftCount: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  hRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  hReason: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  hDelta: { fontFamily: fonts.bold, fontSize: 15 },
});
