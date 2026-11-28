import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { I18nManager } from 'react-native';
import { ar } from './ar';
import { en, type Dict } from './en';
import { fr } from './fr';

/** English, French, Arabic (RTL). New languages: add a dictionary and an entry here. */
export type Lang = 'en' | 'fr' | 'ar';
export const LANGS: { code: Lang; native: string }[] = [
  { code: 'en', native: 'English' }, { code: 'fr', native: 'Français' }, { code: 'ar', native: 'العربية' },
];
const DICTS: Record<Lang, Dict> = { en, fr, ar };
const KEY = 'whoisfree:lang';
let lang: Lang = 'en';
const listeners = new Set<() => void>();

const deviceLang = (): Lang => {
  const c = getLocales()[0]?.languageCode ?? 'en';
  return c === 'fr' || c === 'ar' ? c : 'en';
};
const applyDirection = (l: Lang) => {
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== (l === 'ar')) I18nManager.forceRTL(l === 'ar');
};
export async function initI18n() {
  const saved = (await AsyncStorage.getItem(KEY).catch(() => null)) as Lang | null;
  lang = saved && saved in DICTS ? saved : deviceLang();
  applyDirection(lang);
}
export const needsRestartFor = (l: Lang) => I18nManager.isRTL !== (l === 'ar');
export async function setLanguage(l: Lang) {
  lang = l;
  await AsyncStorage.setItem(KEY, l).catch(() => {});
  applyDirection(l);
  listeners.forEach((f) => f());
}
export const getLanguage = () => lang;
export function useLanguage(): Lang {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => lang, () => lang);
}
export type TKey = keyof Dict;
export function t(key: TKey, vars?: Record<string, string | number>): string {
  let s: string = DICTS[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
/** Localized category name from a category row. */
export const catName = (c: { name_en: string; name_fr: string; name_ar: string } | undefined) =>
  !c ? '' : lang === 'fr' ? c.name_fr : lang === 'ar' ? c.name_ar : c.name_en;
/** "1 h 20 min" style remaining time. */
export function duration(ms: number) {
  const m = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(m / 60), r = m % 60;
  const H = lang === 'ar' ? 'س' : 'h', M = lang === 'ar' ? 'د' : 'min';
  return h ? `${h} ${H}${r ? ` ${r} ${M}` : ''}` : `${r} ${M}`;
}
