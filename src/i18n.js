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

// Strona jest polska — język zablokowany na PL (koniec międzynarodowości)
const savedLanguage = 'pl';

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

export default i18n;
