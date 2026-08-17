/* src/Context/SessionContext.test.jsx
 *
 * Testy najważniejszego zachowania SessionContext:
 *  - przeterminowana sesja (TTL 12h) jest czyszczona przy starcie,
 *  - wygaśnięcie sesji W TRAKCIE przeglądania strony wywłogowuje
 *    automatycznie (bez reloadu),
 *  - logout() czyści sesję i przeładowuje na czysty URL.
 */

import { renderHook, act } from '@testing-library/react';
import { SessionProvider, useSession, SESSION_TTL_MS } from './SessionContext';

const SESSION_KEY = 'ZPK_auth_session';

const makeSession = (overrides = {}) => ({
  access_token: 'tok_123',
  user_id: '123456',
  username: 'TestUser',
  avatar: null,
  is_admin: false,
  is_dev_member: true,
  is_main_member: true,
  timestamp: Date.now(),
  ...overrides
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  localStorage.clear();
  sessionStorage.clear();
});

test('przeterminowana sesja (TTL 12h) jest czyszczona przy starcie — brak dostępu', () => {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(makeSession({ timestamp: Date.now() - SESSION_TTL_MS - 1000 }))
  );

  const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });

  expect(result.current.isLoggedIn).toBe(false);
  expect(result.current.session).toBeNull();
  // Sesja musi zniknąć też z localStorage — AuthGuard/DevGuard/KOS
  // czytają z niego i nie mogą zobaczyć wygasłego tokena.
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
});

test('ważna sesja jest akceptowana z dodatnim licznikiem czasu', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(makeSession()));

  const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });

  expect(result.current.isLoggedIn).toBe(true);
  expect(result.current.timeLeft).toBeGreaterThan(0);
  expect(result.current.timeLeft).toBeLessThanOrEqual(SESSION_TTL_MS);
});

test('wygaśnięcie sesji w trakcie przeglądania strony = auto-logout w ~1s', () => {
  // Sesja wygaśnie za ~1,5 sekundy od teraz.
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(makeSession({ timestamp: Date.now() - SESSION_TTL_MS + 1500 }))
  );

  const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });
  expect(result.current.isLoggedIn).toBe(true);

  act(() => {
    jest.advanceTimersByTime(2000);
  });

  expect(result.current.isLoggedIn).toBe(false);
  expect(result.current.session).toBeNull();
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
});

test('logout() czyści sesję i uruchamia pełny reload na czysty URL', () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(makeSession()));
  sessionStorage.setItem('ZPK_redirect_target', '/kos');

  const { result } = renderHook(() => useSession(), { wrapper: SessionProvider });

  // jsdom obsługuje nawigację hash — replace(#/) nie powinien rzucić;
  // try/catch to tylko zabezpieczenie na inne wersje jsdom. Najważniejsze
  // są efekty uboczne wykonane PRZED nawigacją (czyszczenie sesji).
  let thrown = null;
  act(() => {
    try {
      result.current.logout();
    } catch (e) {
      thrown = e;
    }
  });

  expect(result.current.isLoggedIn).toBe(false);
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  expect(sessionStorage.getItem('ZPK_redirect_target')).toBeNull();

  if (thrown) {
    // Jeśli środowisko testowe nie obsłuży nawigacji — to oczekiwany błąd,
    // w przeglądarce replace działa normalnie.
    expect(String(thrown && thrown.message)).toMatch(/not implemented/i);
  }
});
