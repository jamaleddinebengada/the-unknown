import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { I18nManager } from 'react-native';
import { ar } from './ar';
import { en, type Dict } from './en';
import { es } from './es';
import { fr } from './fr';

export type Lang = 'en' | 'fr' | 'ar' | 'es';
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'es', label: 'Spanish', native: 'Español' },
];
const DICTS: Record<Lang, Partial<Dict>> = { en, fr, ar, es };
const KEY = 'the-unknown:lang';

let lang: Lang = 'en';
const listeners = new Set<() => void>();

function deviceLang(): Lang {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (['fr', 'ar', 'es'] as const).includes(code as 'fr') ? (code as Lang) : 'en';
}

/** Loads the saved (or device) language before the first screen renders. */
export async function initI18n() {
  const saved = (await AsyncStorage.getItem(KEY).catch(() => null)) as Lang | null;
  lang = saved && saved in DICTS ? saved : deviceLang();
  applyDirection(lang);
}

/** Arabic is right-to-left. React Native applies a direction change on the next app start. */
function applyDirection(l: Lang) {
  const rtl = l === 'ar';
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
}
/** True when the layout direction will only flip after the app is reopened. */
export const needsRestartFor = (l: Lang) => I18nManager.isRTL !== (l === 'ar');

export async function setLanguage(l: Lang) {
  lang = l;
  await AsyncStorage.setItem(KEY, l).catch(() => {});
  applyDirection(l);
  listeners.forEach((f) => f());
}
export const getLanguage = () => lang;

/** Re-renders the caller when the language changes. */
export function useLanguage(): Lang {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => lang, () => lang);
}

export type TKey = keyof Dict;
export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s = (DICTS[lang][key] ?? en[key] ?? key) as string;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
