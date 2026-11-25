import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ShieldEmblem } from '@/components/Emblem';
import { Screen, StackHeader } from '@/components/Screen';
import { Group, Row } from '@/components/SettingsUI';
import { T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';

const TIPS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'eye-off-outline', title: 'Stay anonymous as long as you want', body: 'Nobody can see your name, photos or contacts unless you both agree to reveal — and you choose exactly what to share.' },
  { icon: 'cash-outline', title: 'Never send money', body: 'No one on THE UNKNOWN needs your money, gift cards, bank details or codes. Report anyone who asks.' },
  { icon: 'location-outline', title: 'Keep your location private', body: 'Nearby only uses your approximate area and shows distance bands. Never share your address or live location in chat.' },
  { icon: 'people-outline', title: 'Meeting in person', body: 'If you decide to meet, choose a public place, tell a friend where you are and arrange your own transport.' },
  { icon: 'sparkles-outline', title: 'AI characters are fictional', body: 'Characters with the AI badge are not real people. Don’t share private details with them either.' },
];

/** Safety Center — every safety tool is free for everyone. */
export default function Safety() {
  const router = useRouter();
  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Safety Center" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <ShieldEmblem size={120} icon="🛡️" />
          <T style={{ fontFamily: fonts.extrabold, fontSize: 22 }}>Your safety comes first</T>
          <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>Blocking, reporting, privacy and deleting your data are always free.</T>
        </View>
        <Group title="TOOLS">
          <Row icon="flag-outline" label="Report a user or message" sub="Open their profile or long-press a message → Report" />
          <Row icon="ban-outline" label="Blocked members" onPress={() => router.push('/settings')} />
          <Row icon="shield-checkmark-outline" label="Identity & Privacy" sub="Photos, contact rules, visibility" onPress={() => router.push('/privacy')} />
          <Row icon="location-outline" label="People Nearby" sub="Turn on, change area or erase it" onPress={() => router.push('/nearby')} />
          <Row icon="trash-outline" label="Delete my data" sub="Settings → Account & Security" onPress={() => router.push('/settings')} danger last />
        </Group>
        <View style={{ gap: 10 }}>
          <T v="overline" color={colors.textMuted}>SAFETY TIPS</T>
          {TIPS.map((t, i) => (
            <Animated.View key={t.title} entering={FadeInDown.delay(i * 50)} style={s.tip}>
              <View style={s.icon}><Ionicons name={t.icon} size={20} color={colors.text} /></View>
              <View style={{ flex: 1, gap: 2 }}><T style={{ fontFamily: fonts.bold }}>{t.title}</T><T v="caption" color={colors.textSecondary}>{t.body}</T></View>
            </Animated.View>
          ))}
        </View>
        <View style={s.urgent}>
          <Ionicons name="warning-outline" size={20} color={colors.danger} />
          <T v="caption" style={{ flex: 1 }}>If you or someone else is in immediate danger, contact your local emergency services right away.</T>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  tip: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  urgent: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, backgroundColor: '#FFF1F4', borderWidth: 1, borderColor: '#FFE1E8' },
});
