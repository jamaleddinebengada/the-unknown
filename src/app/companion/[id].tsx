import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { GradientButton, IconButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { getCompanion, LANG_LABEL, startCompanionChat, type Companion } from '@/features/companions/api';
import { AiBadge, DisclosureSheet, Portrait, ScenePicture } from '@/features/companions/ui';
import { catName, t } from '@/i18n';
import { friendlyError } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';

/** AI companion profile — no distance, no availability, no meetup actions. */
export default function CompanionProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { map } = useCategories();
  const [c, setC] = useState<Companion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disclose, setDisclose] = useState(false);
  useFocusEffect(useCallback(() => { getCompanion(id).then(setC).catch((e) => setError(friendlyError(e))); }, [id]));

  const openChat = () => (c?.chat ? router.push({ pathname: '/companion-chat/[id]', params: { id } }) : setDisclose(true));
  const hero = Math.min(width - 40, 380);

  if (!c) return <View style={[s.center, { paddingTop: insets.top }]}>{error ? <Text style={s.muted}>{error}</Text> : <ActivityIndicator color={colors.text} />}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 110, gap: 16 }}>
        <View style={s.top}><IconButton name="chevron-back" label={t('common.back')} onPress={() => router.back()} /></View>
        <View style={{ alignItems: 'center' }}><Portrait avatar={c.avatar} path={c.portrait_path} size={hero} radius={30} /></View>
        <View style={s.pad}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={s.name}>{c.name}, {c.age}</Text><AiBadge full /></View>
          <Text style={s.job}>{c.occupation}</Text>
          <Text style={s.tag}>“{c.tagline}”</Text>
        </View>
        <View style={[s.pad, s.notice]}><Ionicons name="information-circle" size={18} color={colors.accent} /><Text style={s.noticeText}>{t('ai.notice')}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
          {c.photos.map((p) => <ScenePicture key={p.scene} photo={p} avatar={c.avatar} width={width * 0.62} height={width * 0.62 * 1.15} />)}
        </ScrollView>
        <View style={[s.pad, s.card]}>
          <Text style={s.h}>{t('ai.about')}</Text>
          <Text style={s.body}>{c.bio}</Text>
          <Text style={s.h}>{t('ai.vibe')}</Text>
          <View style={s.chips}>{c.traits.map((x) => <View key={x} style={s.chip}><Text style={s.chipT}>{x}</Text></View>)}</View>
          <Text style={s.h}>{t('ai.likes')}</Text>
          <View style={s.chips}>{c.interests.map((i) => { const k = map.get(i); return <View key={i} style={s.chip}><Text style={s.chipT}>{k ? `${k.emoji} ${catName(k)}` : i}</Text></View>; })}</View>
          <Text style={s.h}>{t('ai.speaks')}</Text>
          <View style={s.chips}>{c.languages.map((l) => <View key={l} style={[s.chip, { backgroundColor: colors.accentSoft }]}><Text style={s.chipT}>{LANG_LABEL[l] ?? l}</Text></View>)}</View>
          {!c.portrait_path && <Text style={s.small}>🎨 {t('ai.illustration')}</Text>}
        </View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <GradientButton icon="chatbubble-ellipses" label={c.chat ? t('ai.continue') : t('ai.chat', { name: c.name })} onPress={openChat} />
      </View>
      <DisclosureSheet visible={disclose} name={c.name} avatar={c.avatar} path={c.portrait_path} onClose={() => setDisclose(false)}
        onAccept={async (memory) => {
          try { await startCompanionChat(c.id, memory); setDisclose(false); router.push({ pathname: '/companion-chat/[id]', params: { id: c.id } }); }
          catch (e) { toast(friendlyError(e), 'error'); }
        }} />
    </View>
  );
}
const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  top: { paddingHorizontal: 12, flexDirection: 'row' },
  pad: { marginHorizontal: 20 },
  name: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  job: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  tag: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, marginTop: 8, fontStyle: 'italic' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: colors.accentSoft },
  noticeText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  card: { padding: 18, borderRadius: 22, backgroundColor: colors.white, gap: 8 },
  h: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: colors.primarySoft },
  chipT: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  small: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textMuted, marginTop: 6 },
  muted: { fontFamily: fonts.medium, color: colors.textMuted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: 'rgba(247,248,250,0.96)' },
});
