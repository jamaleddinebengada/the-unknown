import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Atmosphere } from '@/components/Atmosphere';
import { PortalMark, Wordmark } from '@/components/Logo';
import { colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';

/** Splash: shows the portal briefly, then routes to the right place. */
export default function Splash() {
  const { ready, entered } = useAuth();
  const [minDelay, setMinDelay] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMinDelay(true), 1100); return () => clearTimeout(t); }, []);

  if (ready && minDelay) {
    return <Redirect href={entered ? '/nearby' : '/welcome'} />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <Atmosphere stars={30} />
      <Animated.View entering={FadeIn.duration(600)}><PortalMark size={132} /></Animated.View>
      <Animated.View entering={FadeIn.delay(250).duration(700)}><Wordmark size={22} /></Animated.View>
    </View>
  );
}
