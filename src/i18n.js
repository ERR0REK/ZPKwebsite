/* src/i18n.js */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importuj pliki z tłumaczeniami (upewnij się, że ścieżki są poprawne)
import pl from '../src/Locales/pl.json';
import en from '../src/Locales/en.json';

const resources = {
    pl: {
        translation: pl
    },
    en: {
        translation: en
    }
};

// Read saved language from localStorage, default to Polish
const getSavedLanguage = () => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('selectedLanguage') || localStorage.getItem('i18nextLng') || 'pl';
    } catch (e) {
      return 'pl';
    }
  }
  return 'pl';
};

const savedLanguage = getSavedLanguage();

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLanguage,
        fallbackLng: 'pl',
        interpolation: {
            escapeValue: false
        }
    });

// Expose i18n on window for E2E tests and external access
if (typeof window !== 'undefined') {
  window.i18n = i18n;
}

export default i18n;
