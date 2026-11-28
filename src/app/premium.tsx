import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';

const PLANS: { name: string; color: readonly [string, string]; features: string[] }[] = [
  { name: 'Free', color: ['#FFFFFF', '#F7F8FA'], features: ['Profile & photos', "I'm free now", 'Nearby people & activities', 'Requests & chat', 'Join free groups', 'All privacy & safety tools'] },
  { name: 'Plus', color: ['#FFF6C2', '#FFE24D'], features: ['Everything in Free', 'Wider radius (up to 200 km)', 'Advanced filters', 'Plan availability for later days', 'More daily requests', 'Monthly boost'] },
  { name: 'Elite', color: ['#EEE8FF', '#C9BCFF'], features: ['Everything in Plus', 'AI activity planner', 'Partner experiences', 'Extra boosts', 'Premium profile themes'] },
];

/** Plans overview. No price is shown and nothing can be bought until Google Play products and RevenueCat are configured. */
export default function Premium() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={[s.head, { paddingTop: insets.top + 6 }]}>
        <IconButton name="close" label={t('common.cancel')} onPress={() => router.back()} />
        <Text style={s.title}>{t('premium.title')}</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 30 }}>
        {PLANS.map((p) => (
          <LinearGradient key={p.name} colors={p.color} style={s.card}>
            <Text style={s.plan}>{p.name === 'Free' ? 'WhoIsFree' : `WhoIsFree ${p.name}`}</Text>
            {p.features.map((f) => <View key={f} style={s.f}><Ionicons name="checkmark-circle" size={18} color={colors.text} /><Text style={s.fText}>{f}</Text></View>)}
          </LinearGradient>
        ))}
        <View style={s.note}><Ionicons name="information-circle" size={20} color={colors.accent} /><Text style={s.noteText}>{t('premium.unavailable')}</Text></View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  card: { padding: 18, borderRadius: 24, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  plan: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, marginBottom: 4 },
  f: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fText: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.accentSoft },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, lineHeight: 19 },
});
