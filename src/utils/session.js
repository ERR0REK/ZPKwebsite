/**
 * src/utils/session.js
 *
 * Jedyny moduł, który dotyka localStorage sesji (vault).
 *
 * Wcześniej: SessionContext, DiscordCallback i SecurityLayer czytały/pisały
 * surowy klucz 'ZPK_auth_session' każdy po swojemu — SecurityLayer bez
 * walidacji TTL, DiscordCallback pisał obok walidatora (dwie polityki
 * ważności dla tej samej koncepcji).
 *
 * Interfejs:
 *   SESSION_TTL_MS       — czas życia sesji (12h)
 *   saveSession(data)    — zapis sesji
 *   clearSession()       — usunięcie sesji
 *   readSession()        — luźny odczyt: co fizycznie siedzi w storage
 *   loadValidSession()   — odczyt + walidacja (user_id + TTL); sesja
 *                          przeterminowana/niepełna jest czyszczona → null
 *   OAUTH_STATE_KEY      — klucz nonce OAuth (parametr `state`)
 *   generateOAuthState() — losowy nonce dla OAuth
 *
 * WAŻNE: w komponentach pod Providerem preferuj useSession() z
 * SessionContext. Te funkcje są dla wyjątków (DiscordCallback poza
 * Providerem) i dla spójnej walidacji tam, gdzie kiedyś czytano surowy klucz.
 */

// Jedyna kopia klucza w src/ — wszyscy czytają go stąd.
export const SESSION_KEY = 'ZPK_auth_session';

// Czas życia sesji — jedyna kopia (SessionContext re-eksportuje).
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const saveSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    /* ignore */
  }
};

// Luźny odczyt — co fizycznie siedzi w storage, bez walidacji TTL.
// Używany tam, gdzie liczy się "czy cokolwiek jest zapisane" (np. edge
// redirect w DiscordCallback). Do sprawdzania ważności użyj loadValidSession().
export const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

// Odczyt + walidacja (user_id + TTL 12h). Jedna polityka ważności dla
// wszystkich ścieżek: przeterminowana/niepełna sesja jest czyszczona
// i traktowana jak brak sesji. Zepsuty JSON też jest czyszczony.
export const loadValidSession = () => {
  const session = readSession();
  if (!session || !session.user_id) {
    clearSession();
    return null;
  }
  if (Date.now() - (session.timestamp || 0) > SESSION_TTL_MS) {
    clearSession();
    return null;
  }
  return session;
};

// ============================================================
// OAuth nonce (parametr `state`) — ochrona przed login CSRF.
// Klucz współdzielony między LoginPage (generuje) a DiscordCallback
// (weryfikuje), bo oba działają w tej samej karcie (sessionStorage jest per-tab).
// ============================================================

export const OAUTH_STATE_KEY = 'ZPK_oauth_state';

const getCrypto = () => {
  try {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      return window.crypto;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    // typeof guard — bez tego ESLint zgłasza no-undef dla niezadeklarowanego globala.
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') {
      return crypto;
    }
  } catch (e) {
    /* ignore */
  }
  return null;
};

// Losowy nonce (32 znaki hex) do parametru `state` w OAuth Discorda.
export const generateOAuthState = () => {
  try {
    const cryptoObj = getCrypto();
    if (!cryptoObj) throw new Error('crypto unavailable');
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback dla środowisk bez crypto — wystarczający dla jednorazowego nonce.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
};