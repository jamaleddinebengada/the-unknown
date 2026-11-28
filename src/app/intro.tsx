import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/ui';
import { Pulse } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { getLanguage, t, type TKey } from '@/i18n';

const SLIDES: { key: string; emojis: string[]; bg: readonly [string, string] }[] = [
  { key: '1', emojis: ['🏙️', '☕', '📍', '🎉'], bg: ['#FFF8CC', '#FFE24D'] },
  { key: '2', emojis: ['🙋‍♀️', '🤝', '🙋‍♂️', '💬'], bg: ['#EEE8FF', '#C9BCFF'] },
  { key: '3', emojis: ['⚽', '✈️', '🎮', '💼'], bg: ['#E7ECFF', '#AFC0FF'] },
  { key: '4', emojis: ['⚡', '🌅', '🎶', '🥾'], bg: ['#FFF8CC', '#FFD600'] },
];

/** Four onboarding screens, then sign-up / sign-in. */
export default function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [i, setI] = useState(0);
  const list = useRef<FlatList>(null);
  const last = i === SLIDES.length - 1;
  const artH = Math.min(height * 0.48, 420);

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList ref={list} data={SLIDES} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(x) => x.key}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index }) => (
          <View style={{ width }}>
            <LinearGradient colors={item.bg} style={[s.art, { height: artH + insets.top, paddingTop: insets.top }]}>
              <View style={s.circle}>
                {item.emojis.map((e: string, k: number) => (
                  <Animated.Text key={k} entering={ZoomIn.delay(120 * k).springify()} style={[s.emoji, POS[k]]}>{e}</Animated.Text>
                ))}
                <View style={s.center}><Pulse size={14} color={colors.text} /></View>
              </View>
            </LinearGradient>
            <Animated.View entering={FadeInDown.delay(100)} style={s.copy}>
              <Text style={s.title}>{t(`intro.${index + 1}.title` as TKey)}</Text>
              <Text style={s.body}>{t(`intro.${index + 1}.body` as TKey)}</Text>
            </Animated.View>
          </View>
        )} />
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.dots}>{SLIDES.map((x, k) => <View key={x.key} style={[s.dot, k === i && s.dotOn]} />)}</View>
        {last ? (
          <>
            <GradientButton label={t('intro.start')} arrow onPress={() => router.push('/auth/sign-up')} />
            <Pressable onPress={() => router.push('/auth/sign-in')} style={{ alignSelf: 'center', padding: 8 }}><Text style={s.link}>{t('intro.signIn')}</Text></Pressable>
            <Text style={s.legal}>{t('intro.adults')}</Text>
          </>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => list.current?.scrollToIndex({ index: SLIDES.length - 1 })} hitSlop={10}><Text style={s.skip}>{t('common.skip')}</Text></Pressable>
            <Pressable onPress={() => list.current?.scrollToIndex({ index: i + 1 })} style={s.next} accessibilityRole="button" accessibilityLabel={t('common.continue')}>
              <Ionicons name={getLanguage() === 'ar' ? 'arrow-back' : 'arrow-forward'} size={24} color={colors.text} />
            </Pressable>
          </View>
        )}
        <Pressable onPress={() => router.push('/language')} style={{ alignSelf: 'center' }} hitSlop={8}><Text style={s.lang}>🌐 {getLanguage().toUpperCase()}</Text></Pressable>
      </View>
    </View>
  );
}

const POS = [{ left: '8%', top: '12%' }, { right: '6%', top: '20%' }, { left: '16%', bottom: '10%' }, { right: '14%', bottom: '14%' }] as const;
const s = StyleSheet.create({
  art: { alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  circle: { width: 270, height: 270, borderRadius: 135, backgroundColor: 'rgba(255,255,255,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  center: { position: 'absolute', left: 128, top: 128 },
  emoji: { position: 'absolute', fontSize: 58 },
  copy: { paddingHorizontal: 28, paddingTop: 28, gap: 10 },
  title: { fontFamily: fonts.extrabold, fontSize: 32, color: colors.text, letterSpacing: -0.8 },
  body: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 25, color: colors.textMuted },
  footer: { paddingHorizontal: 24, gap: 14 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { width: 26, backgroundColor: colors.text },
  next: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  skip: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textMuted },
  link: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, textDecorationLine: 'underline' },
  legal: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  lang: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
});
