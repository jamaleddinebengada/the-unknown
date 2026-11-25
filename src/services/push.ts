import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Push notifications through Firebase Cloud Messaging (Android).
 * Works once the build contains google-services.json (GitHub secret GOOGLE_SERVICES_JSON) and the
 * `send-push` edge function has the FCM service account. Without them registration fails quietly.
 * The token is stored in push_tokens (RLS: own rows only); messages are sent from the server only.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let registered = false;
export async function registerForPush(userId: string) {
  if (registered || Platform.OS !== 'android') return;
  // the build only contains FCM when google-services.json was provided — don't ask for permission otherwise
  if (!Constants.expoConfig?.android?.googleServicesFile) return;
  try {
    await Notifications.setNotificationChannelAsync('default', { name: 'Messages & matches', importance: AndroidImportance.HIGH });
    const cur = await Notifications.getPermissionsAsync();
    const perm = cur.granted ? cur : await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== 'string' || !token) return;
    await supabase.from('push_tokens').upsert({ token, user_id: userId, platform: 'fcm', updated_at: new Date().toISOString() });
    registered = true;
  } catch {
    // no Firebase config in this build yet
  }
}
