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
 *   ACCESS_TOKEN_TTL_MS    — czas życia access tokenu (15 min)
 *   REFRESH_TOKEN_TTL_MS   — czas życia refresh tokenu (7 dni)
 *   saveSession(data)      — zapis sesji (access token + metadata)
 *   saveRefreshToken(token) — zapis refresh tokenu (HttpOnly cookie via Netlify Function)
 *   clearSession()         — usunięcie sesji i refresh tokenu
 *   clearRefreshToken()    — usunięcie tylko refresh tokenu
 *   readSession()          — luźny odczyt: co fizycznie siedzi w storage
 *   loadValidSession()     — odczyt + walidacja (user_id + TTL); sesja
 *                          przeterminowana/niepełna jest czyszczona → null
 *   isSessionValid()       — sprawdza czy access token jest ważny lub może być odświeżony
 *   invalidateSession()    — unieważnia sesję (password/role change, logout all devices)
 *   getSessionMetadata()   — pobiera metadane sesji (IP, UA, created_at)
 *   OAUTH_STATE_KEY        — klucz nonce OAuth (parametr `state`)
 *   generateOAuthState()   — losowy nonce dla OAuth
 *
 * WAŻNE: w komponentach pod Providerem preferuj useSession() z
 * SessionContext. Te funkcje są dla wyjątków (DiscordCallback poza
 * Providerem) i dla spójnej walidacji tam, gdzie kiedyś czytano surowy klucz.
 */

// Jedyna kopia klucza w src/ — wszyscy czytają go stąd.
export const SESSION_KEY = 'ZPK_auth_session';

// Klucz refresh tokenu (przechowywany w HttpOnly cookie przez Netlify Function,
// tutaj tylko fallback do localStorage dla developmentu bez backend)
export const REFRESH_TOKEN_KEY = 'ZPK_refresh_token';

// Czas życia access tokenu — 15 minut (Discord OAuth daje krótkotrwałe tokeny)
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

// Czas życia refresh tokenu — 7 dni
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Dla kompatybilności wstecznej (SessionContext re-eksportuje)
export const SESSION_TTL_MS = ACCESS_TOKEN_TTL_MS;

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

export const clearRefreshToken = () => {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // Wywołaj Netlify Function do usunięcia HttpOnly cookie
    if (typeof window !== 'undefined') {
      fetch('/.netlify/functions/auth-refresh', {
        method: 'DELETE',
        credentials: 'include'
      }).catch(() => { /* ignore network errors */ });
    }
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

// Odczyt refresh tokenu (fallback do localStorage gdy brak HttpOnly cookie)
export const readRefreshToken = () => {
  try {
    const raw = localStorage.getItem(REFRESH_TOKEN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

// Zapis refresh tokenu (fallback do localStorage gdy brak HttpOnly cookie)
export const saveRefreshToken = (tokenData) => {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, JSON.stringify(tokenData));
  } catch (e) {
    /* ignore */
  }
};

// Odczyt + walidacja (user_id + TTL 15min). Jedna polityka ważności dla
// wszystkich ścieżek: przeterminowana/niepełna sesja jest czyszczona
// i traktowana jak brak sesji. Zepsuty JSON też jest czyszczony.
export const loadValidSession = () => {
  const session = readSession();
  if (!session || !session.user_id) {
    clearSession();
    return null;
  }
  if (Date.now() - (session.timestamp || 0) > ACCESS_TOKEN_TTL_MS) {
    clearSession();
    return null;
  }
  return session;
};

// Sprawdza czy sesja jest ważna lub może zostać odświeżona
// Zwraca: { valid: boolean, needsRefresh: boolean, session: object|null }
export const isSessionValid = () => {
  const session = readSession();

  if (!session || !session.user_id) {
    return { valid: false, needsRefresh: false, session: null };
  }

  const accessTokenAge = Date.now() - (session.timestamp || 0);

  // Access token nadal ważny
  if (accessTokenAge <= ACCESS_TOKEN_TTL_MS) {
    return { valid: true, needsRefresh: false, session };
  }

  // Access token wygasł, sprawdź refresh token
  const refreshToken = readRefreshToken();
  if (refreshToken && refreshToken.token) {
    const refreshTokenAge = Date.now() - (refreshToken.createdAt || 0);
    if (refreshTokenAge <= REFRESH_TOKEN_TTL_MS) {
      return { valid: false, needsRefresh: true, session };
    }
  }

  // Refresh token też wygasł lub nie ma — wyczyść wszystko
  clearSession();
  clearRefreshToken();
  return { valid: false, needsRefresh: false, session: null };
};

// Unieważnia sesję (password change, role change, logout all devices)
export const invalidateSession = (reason = 'manual') => {
  const session = readSession();

  // Zapisz log unieważnienia (można rozszerzyć o wysyłkę do backendu)
  if (session && typeof window !== 'undefined') {
    const invalidationLog = {
      userId: session.user_id,
      reason,
      timestamp: Date.now(),
      ip: session.ip,
      userAgent: session.userAgent
    };
    try {
      const logs = JSON.parse(localStorage.getItem('ZPK_session_invalidations') || '[]');
      logs.push(invalidationLog);
      localStorage.setItem('ZPK_session_invalidations', JSON.stringify(logs.slice(-50)));
    } catch (e) {
      /* ignore */
    }
  }

  clearSession();
  clearRefreshToken();
};

// Pobiera metadane sesji (IP, UA, created_at)
export const getSessionMetadata = () => {
  const session = readSession();
  if (!session) return null;

  return {
    userId: session.user_id,
    ip: session.ip,
    userAgent: session.userAgent,
    createdAt: session.timestamp,
    lastActivity: session.lastActivity || session.timestamp,
    roles: session.roles || []
  };
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
  const cryptoObj = getCrypto();
  if (!cryptoObj) throw new Error('crypto.getRandomValues unavailable — OAuth state generation requires a secure random source');
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

// ============================================================
// PKCE (RFC 7636) — Authorization Code Flow with Proof Key for Code Exchange
// Klucz współdzielony między LoginPage (generuje) a DiscordCallback
// (używa do wymiany kodu na token), bo oba działają w tej samej karcie.
// ============================================================

export const PKCE_VERIFIER_KEY = 'ZPK_pkce_verifier';

// Generuje code_verifier (43-128 znaków, URL-safe base64, RFC 7636).
export const generateCodeVerifier = () => {
  const cryptoObj = getCrypto();
  if (!cryptoObj) throw new Error('crypto.getRandomValues unavailable — PKCE verifier generation requires a secure random source');
  // 32 bajty = 43 znaki base64url (bez paddingu) — w przedziale 43-128
  const bytes = new Uint8Array(32);
  cryptoObj.getRandomValues(bytes);
  // Base64URL encoding (bez paddingu, bez +/)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Generuje code_challenge = SHA256(code_verifier) base64url-encoded.
export const generateCodeChallenge = async (codeVerifier) => {
  const cryptoObj = getCrypto();
  if (!cryptoObj || !cryptoObj.subtle) throw new Error('crypto.subtle unavailable — PKCE challenge generation requires Web Crypto API');
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  // Base64URL encoding (bez paddingu, bez +/)
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};