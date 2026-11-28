export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'ar', label: 'العربية' }, { code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }, { code: 'es', label: 'Español' },
  { code: 'zgh', label: 'ⵜⴰⵎⴰⵣⵉⵖⵜ' }, { code: 'de', label: 'Deutsch' }, { code: 'it', label: 'Italiano' }, { code: 'pt', label: 'Português' }, { code: 'tr', label: 'Türkçe' },
];
export const langName = (c: string) => LANGUAGES.find((l) => l.code === c)?.label ?? c;
