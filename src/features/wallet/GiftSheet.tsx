import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet, useToast } from '@/components/Overlay';
import { colors, fonts } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getGiftCatalog, getWallet, sendGift, type Gift } from '@/services/api';
import { t } from '@/i18n';
import { haptic } from '@/utils/format';

/** Pick a virtual gift; the server checks and deducts the coins. */
export function GiftSheet({ visible, onClose, number, onSent }: { visible: boolean; onClose: () => void; number: number; onSent?: (conversationId: string | null) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [gifts, setGifts] = useState<Gift[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    getGiftCatalog().then(setGifts).catch((e) => toast(friendlyError(e), 'error'));
    getWallet().then((w) => setBalance(w.balance)).catch(() => {});
  }, [visible, toast]);

  const send = async (g: Gift) => {
    if (balance !== null && balance < g.price) { onClose(); router.push('/wallet'); toast(friendlyError(new Error('not_enough_coins'))); return; }
    setBusy(g.id);
    try {
      const r = await sendGift(number, g.id);
      setBalance(r.balance); haptic.success(); toast(t('gift.sent', { name: `${g.emoji} ${g.name}` }), 'success');
      onSent?.(r.conversation_id); onClose();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('gift.title')}>
      <View style={s.top}>
        <Text style={s.bal}>🪙 {balance === null ? '…' : t('gift.balance', { n: balance })}</Text>
        <Pressable onPress={() => { onClose(); router.push('/wallet'); }} hitSlop={8}><Text style={s.link}>{t('gift.topUp')}</Text></Pressable>
      </View>
      {!gifts ? <ActivityIndicator color={colors.primary} style={{ margin: 30 }} /> : (
        <View style={s.grid}>
          {gifts.map((g) => (
            <Pressable key={g.id} onPress={() => send(g)} disabled={!!busy} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.primarySoft }]} accessibilityLabel={`${g.name}, ${g.price} coins`}>
              {busy === g.id ? <ActivityIndicator color={colors.primary} style={{ height: 36 }} /> : <Text style={s.emoji}>{g.emoji}</Text>}
              <Text style={s.name} numberOfLines={1}>{g.name}</Text>
              <Text style={s.price}>🪙 {g.price}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bal: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 },
  item: { width: '23%', flexGrow: 1, alignItems: 'center', gap: 2, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  emoji: { fontSize: 32, height: 36 },
  name: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  price: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
});
