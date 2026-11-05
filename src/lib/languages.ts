/** Languages offered during setup; language names remain in their own script. */
export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', mark: 'En', rtl: false },
  { code: 'es', name: 'Spanish', nativeName: 'Español', mark: 'Es', rtl: false },
  { code: 'fr', name: 'French', nativeName: 'Français', mark: 'Fr', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', mark: 'Pt', rtl: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', mark: 'ع', rtl: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', mark: 'हि', rtl: false },
  { code: 'zh', name: 'Chinese', nativeName: '简体中文', mark: '中', rtl: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', mark: 'Id', rtl: false },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', mark: 'Sw', rtl: false },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ', mark: 'አ', rtl: false },
] as const;

export type Language = typeof languages[number]['code'];

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && languages.some(language => language.code === value);
}

export const languageInfo = (code: Language) => languages.find(language => language.code === code)!;
