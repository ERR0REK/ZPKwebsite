/* src/Locales/locales.test.js
 *
 * Parity test: pl.json i en.json muszą mieć IDENTYCZNY zestaw kluczy
 * (włącznie ze strukturą tablic, np. changelog.release). Łapie regresje typu
 * brakujący klucz po dodaniu nowej sekcji.
 *
 * Wyjątek: changelog.dev jest świadomie tylko po polsku (sekcja DEV jest
 * zablokowana DevGuardem i nie była nigdy w pełni tłumaczona) — pomijamy ją.
 */

import pl from './pl.json';
import en from './en.json';

const flatten = (obj, prefix = '', result = []) => {
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object') {
      flatten(value, path, result);
    } else {
      result.push(path);
    }
  }
  return result;
};

describe('parity tłumaczeń pl/en', () => {
  const skipDev = (k) => !k.startsWith('changelog.dev.');
  const plKeys = flatten(pl).filter(skipDev);
  const enKeys = flatten(en).filter(skipDev);
  const plSet = new Set(plKeys);
  const enSet = new Set(enKeys);

  it('pl i en mają identyczny zestaw kluczy', () => {
    const missingInEn = plKeys.filter((k) => !enSet.has(k));
    const missingInPl = enKeys.filter((k) => !plSet.has(k));

    expect({ missingInEn, missingInPl }).toEqual({
      missingInEn: [],
      missingInPl: [],
    });
  });
});