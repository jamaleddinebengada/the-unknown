import * as Linking from 'expo-linking';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { T } from '@/components/ui';
import { colors } from '@/constants/theme';
import { completeAuthFromUrl } from '@/services/auth';

/** Deep-link target for OAuth / email confirmation redirects (theunknown://auth/callback?code=…). */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!url) { const t = setTimeout(() => setDone(true), 1500); return () => clearTimeout(t); }
    completeAuthFromUrl(url).catch((e) => setError(String(e?.message ?? e))).finally(() => setDone(true));
  }, [url]);
  if (done && !error) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      {error ? <T color={colors.danger} style={{ textAlign: 'center' }}>{error}</T> : <ActivityIndicator color={colors.violet} />}
      <T color={colors.textSecondary}>{error ? 'Please try signing in again.' : 'Connecting…'}</T>
    </View>
  );
}
