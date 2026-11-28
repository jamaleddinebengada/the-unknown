import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen, StackHeader } from '@/components/Screen';
import { PremiumButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getLanguage, t } from '@/i18n';

const TIPS: Record<string, [string, string][]> = {
  en: [['📍', 'Meet in busy public places for the first time.'], ['🗣️', 'Tell a friend where you go and with whom.'], ['🚕', 'Arrange your own transport.'], ['🍹', 'Watch your drink and stay in control.'], ['🚪', 'Leave whenever you feel uncomfortable.'], ['🚨', 'In danger: call 19 (police, Morocco) or 112.'], ['🛡️', 'Verification badges do not guarantee anyone’s identity or intentions.']],
  fr: [['📍', 'Retrouvez-vous dans un lieu public fréquenté la première fois.'], ['🗣️', 'Prévenez un proche de l’endroit et de la personne.'], ['🚕', 'Gérez votre propre transport.'], ['🍹', 'Surveillez votre verre.'], ['🚪', 'Partez dès que vous êtes mal à l’aise.'], ['🚨', 'En danger : appelez le 19 (police, Maroc) ou le 112.'], ['🛡️', 'Un badge de vérification ne garantit ni l’identité ni les intentions.']],
  ar: [['📍', 'التقِ في مكان عام مزدحم في المرة الأولى.'], ['🗣️', 'أخبر صديقاً إلى أين تذهب ومع من.'], ['🚕', 'رتّب وسيلة نقلك بنفسك.'], ['🍹', 'انتبه لمشروبك.'], ['🚪', 'غادر متى شعرت بعدم الارتياح.'], ['🚨', 'في حالة الخطر: اتصل بـ 19 (الشرطة، المغرب) أو 112.'], ['🛡️', 'شارة التوثيق لا تضمن هوية الشخص أو نواياه.']],
};

export default function Safety() {
  const router = useRouter();
  return (
    <Screen>
      <StackHeader title={t('profile.safety')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 40 }}>
        {(TIPS[getLanguage()] ?? TIPS.en).map(([e, x]) => <View key={x} style={s.row}><Text style={{ fontSize: 24 }}>{e}</Text><Text style={s.text}>{x}</Text></View>)}
        <PremiumButton icon="ban-outline" label={t('settings.blocked')} onPress={() => router.push('/blocked')} />
        <PremiumButton icon="document-text-outline" label={t('settings.guidelines')} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'guidelines' } })} />
      </ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 18, backgroundColor: colors.white },
  text: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text, lineHeight: 20 },
});
