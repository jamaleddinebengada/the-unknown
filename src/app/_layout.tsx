import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import { DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
        <Stack.Screen name="matches" options={{ animation: 'none' }} />
        <Stack.Screen name="premium" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="people" />
        <Stack.Screen name="saved" />
        <Stack.Screen name="rewards" />
        <Stack.Screen name="privacy" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, Fredoka_600SemiBold, Fredoka_700Bold, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold, PlayfairDisplay_700Bold_Italic });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
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
