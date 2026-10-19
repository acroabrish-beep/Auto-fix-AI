import { en } from '../locales/en';
import { am } from '../locales/am';
import { om } from '../locales/om';
import { sid } from '../locales/sid';

export type Language = 'en' | 'am' | 'om' | 'sid';

const dictionaries = {
  en,
  am: { ...en, ...am }, // Fallback to English for missing keys
  om: { ...en, ...om },
  sid: { ...en, ...sid }
};

let currentLang: Language = 'en';

export const setLanguage = (lang: Language) => {
  currentLang = lang;
};

export const getLanguage = (): Language => currentLang;

export const t = (path: string): string => {
  const keys = path.split('.');
  let result: any = dictionaries[currentLang];

  for (const key of keys) {
    if (result && result[key]) {
      result = result[key];
    } else {
      // Try English fallback if not found in current language
      let fallback: any = dictionaries['en'];
      for (const fKey of keys) {
        if (fallback && fallback[fKey]) {
          fallback = fallback[fKey];
        } else {
          return path; // Key not found even in English
        }
      }
      return fallback;
    }
  }

  return typeof result === 'string' ? result : path;
};
