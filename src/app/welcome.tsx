import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Atmosphere } from '@/components/Atmosphere';
import { ConnectIllustration, GlobeIllustration, ShareIllustration } from '@/components/Illustrations';
import { PortalMark, Wordmark } from '@/components/Logo';
import { BackendNotice } from '@/components/Screen';
import { GradientButton, PremiumButton, T } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';

const SLIDES = [
  { key: 'welcome', title: 'Meet people you never expected to meet.', body: 'Meet the unknown. Discover the unexpected.' },
  { key: 'discover', title: 'Discover people beyond your world.', body: 'Stories, questions and secrets from every corner of the planet.' },
  { key: 'share', title: 'Your thoughts can find someone anywhere.', body: 'Post anonymously. The right people will find it — and tell you they’re interested.' },
  { key: 'connect', title: 'Start anonymously. Reveal when you feel ready.', body: 'Identities are only revealed when both of you agree. Always your choice.' },
];

export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ref = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const next = () => {
    if (last) return router.push('/auth');
    ref.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage(page + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Atmosphere stars={50} />
      <View style={{ paddingTop: insets.top }}><BackendNotice /></View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            <View style={styles.art}>
              {i === 0 && <Animated.View entering={FadeIn.duration(900)} style={{ alignItems: 'center', gap: 26 }}><PortalMark size={150} /><Wordmark size={24} /></Animated.View>}
              {i === 1 && <GlobeIllustration size={Math.min(width * 0.72, 300)} />}
              {i === 2 && <ShareIllustration size={Math.min(width * 0.8, 320)} />}
              {i === 3 && <ConnectIllustration size={Math.min(width * 0.78, 320)} />}
            </View>
            <Animated.View entering={FadeInUp.delay(200).springify().damping(18)} style={{ gap: spacing.sm }}>
              <T v="display" style={{ textAlign: 'center' }}>{s.title}</T>
              <T color={colors.textSecondary} style={{ textAlign: 'center', fontSize: 16, lineHeight: 24 }}>{s.body}</T>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => <View key={s.key} style={[styles.dot, i === page && styles.dotOn]} />)}
        </View>
        <GradientButton label={page === 0 ? 'Get Started' : last ? 'Create my account' : 'Continue'} onPress={next} />
        <PremiumButton tone="ghost" label="I already have an account" onPress={() => router.push({ pathname: '/auth/email', params: { mode: 'signin' } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'center', gap: spacing.xxl },
  art: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  footer: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', marginBottom: spacing.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairlineStrong },
  dotOn: { width: 22, backgroundColor: colors.violet },
});
