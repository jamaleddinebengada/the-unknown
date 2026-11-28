import * as Location from 'expo-location';
import { Linking } from 'react-native';
import { nearestCity } from '@/constants/cities';
import { setLocation } from './api';

/**
 * Foreground location only, once, low accuracy (battery friendly). The server snaps it to a ~2 km grid
 * before storing; the exact position never leaves this function except to that call.
 */
export async function shareApproximateLocation(): Promise<{ ok: true; city: string | null } | { ok: false; reason: 'denied' | 'services_off' | 'error' }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: 'denied' };
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'services_off' };
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude: lat, longitude: lng } = pos.coords;
    let city: string | null = null, country: string | null = null;
    try {
      const g = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0];
      city = g?.city ?? g?.subregion ?? g?.region ?? null;
      country = g?.isoCountryCode ?? null;
    } catch { /* offline geocoder */ }
    if (!city) { const n = nearestCity(lat, lng); city = n?.name ?? null; country = country ?? n?.country ?? null; }
    await setLocation(lat, lng, city, country);
    return { ok: true, city };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
export const openAppSettings = () => Linking.openSettings();
