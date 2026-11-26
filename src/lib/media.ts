import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Reliable uploads on Android: read local files with expo-file-system (fetch(file://).arrayBuffer()
 * is not dependable in React Native) and shrink photos before they leave the phone.
 */
export async function fileBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  const bytes = await new File(uri).bytes();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export interface PreparedImage { uri: string; mime: 'image/jpeg'; width: number; height: number }

/** Resize (longest side ≤ maxSide) and re-encode as JPEG — also strips EXIF/GPS metadata. */
export async function optimizeImage(uri: string, maxSide = 1280, quality = 0.8): Promise<PreparedImage> {
  const ctx = ImageManipulator.manipulate(uri);
  const probe = await ctx.renderAsync();
  const big = Math.max(probe.width, probe.height);
  const ref = big > maxSide
    ? await ImageManipulator.manipulate(uri).resize(probe.width >= probe.height ? { width: maxSide } : { height: maxSide }).renderAsync()
    : probe;
  const out = await ref.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return { uri: out.uri, mime: 'image/jpeg', width: out.width, height: out.height };
}

export type PhotoSource = 'camera' | 'library';

/** Camera or gallery, with the system crop UI (4:5 by default), then optimized. Null when cancelled. */
export async function pickPhoto(source: PhotoSource, aspect: [number, number] = [4, 5]): Promise<PreparedImage | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('camera_denied');
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect, quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  return optimizeImage(a.uri);
}

/** Bytes ready to upload: photos are resized + re-encoded to JPEG first (smaller, no EXIF/GPS). */
export async function uploadBytes(uri: string, mime: string): Promise<{ body: ArrayBuffer; mime: string }> {
  if (mime.startsWith('image/') && Platform.OS !== 'web') {
    try { const img = await optimizeImage(uri); return { body: await fileBytes(img.uri), mime: img.mime }; } catch { /* fall back to the original file */ }
  }
  return { body: await fileBytes(uri), mime };
}
