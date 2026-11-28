import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/Overlay';
import { colors } from '@/constants/theme';
import { initI18n, useLanguage } from '@/i18n';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { ready, session, boot } = useAuth();
  useLanguage();
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;
  const signedIn = !!session;
  const onboarded = !!boot?.profile.onboarded;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="auth-callback" options={{ animation: 'fade' }} />
      <Stack.Screen name="legal/[doc]" />
      <Stack.Screen name="language" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="intro" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/sign-in" />
        <Stack.Screen name="auth/sign-up" />
        <Stack.Screen name="auth/reset" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded}>
        <Stack.Screen name="setup/profile" options={{ animation: 'fade' }} />
        <Stack.Screen name="setup/interests" />
        <Stack.Screen name="setup/location" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="free" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="create" options={{ presentation: 'transparentModal', animation: 'fade' }} />
        <Stack.Screen name="person/[id]" />
        <Stack.Screen name="activity/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="activities" />
        <Stack.Screen name="surprise" />
        <Stack.Screen name="chat/[id]" />
        <Stack.Screen name="moments" />
        <Stack.Screen name="moment-new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="location" />
        <Stack.Screen name="blocked" />
        <Stack.Screen name="safety" />
        <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="admin" />
        <Stack.Screen name="companions" />
        <Stack.Screen name="companion/[id]" />
        <Stack.Screen name="companion-chat/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const [i18nReady, setI18nReady] = useState(false);
  useEffect(() => { initI18n().finally(() => setI18nReady(true)); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
          <ToastProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              {fontsLoaded && i18nReady ? <RootNavigator /> : null}
            </AuthProvider>
          </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
