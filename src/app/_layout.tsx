import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/Overlay';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, primary: colors.violet, text: colors.text, border: colors.hairline },
};

function RootNavigator() {
  const { ready, entered } = useAuth();
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Protected guard={!entered} redirectTo="/">
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="setup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="vibe" options={{ animation: 'slide_from_right' }} />
      </Stack.Protected>
      <Stack.Protected guard={entered} redirectTo="/">
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/[id]/index" />
        <Stack.Screen name="post/[id]/interested" />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="user/[number]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="search" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="challenges" />
        <Stack.Screen name="mystery" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="visitors" />
        <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="people" />
        <Stack.Screen name="ai/index" />
        <Stack.Screen name="ai/[id]" />
        <Stack.Screen name="ai/chat/[id]" />
        <Stack.Screen name="safety" />
        <Stack.Screen name="help" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="privacy" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Short entrance animations always finish (with "remove animations" on, Android otherwise leaves
          entering content invisible). Looping/decorative motion still honours the system setting via useReducedMotion. */}
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <AuthProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              {fontsLoaded ? <RootNavigator /> : null}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
