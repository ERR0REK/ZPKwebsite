/**
 * src/utils/session.js
 *
 * Wspólna funkcja readSession() do odczytu sesji z localStorage.
 * Używana w miejscach, gdzie useSession() nie jest dostępne
 * (np. DiscordCallback — renderowany poza SessionProvider).
 *
 * WAŻNE: Preferuj useSession() z SessionContext gdy to możliwe.
 * Ta funkcja jest dla wyjątków (komponenty poza Providerem).
 */

const SESSION_KEY = 'ZPK_auth_session';

export const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};
