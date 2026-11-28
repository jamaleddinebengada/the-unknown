import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Screen, StackHeader } from '@/components/Screen';
import { LEGAL } from '@/constants/legal';
import { colors, fonts } from '@/constants/theme';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = LEGAL[doc] ?? LEGAL.terms;
  return (
    <Screen>
      <StackHeader title={d.title} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}><Text style={s.body}>{d.body}</Text></ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({ body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textSecondary } });
