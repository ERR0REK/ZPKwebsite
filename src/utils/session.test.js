/* src/utils/session.test.js */

import {
  generateOAuthState,
  saveSession,
  readSession,
  loadValidSession,
  clearSession,
  SESSION_TTL_MS,
} from './session';

const SESSION_KEY = 'ZPK_auth_session';

const makeSession = (overrides = {}) => ({
  access_token: 'tok',
  user_id: '123',
  username: 'Test',
  is_admin: false,
  timestamp: Date.now(),
  ...overrides,
});

describe('session vault', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('saveSession + readSession roundtrip', () => {
    saveSession(makeSession());
    expect(readSession().user_id).toBe('123');
  });

  it('loadValidSession akceptuje świeżą sesję', () => {
    saveSession(makeSession());
    expect(loadValidSession().user_id).toBe('123');
  });

  it('przeterminowana sesja → null i czyszczona z localStorage', () => {
    saveSession(makeSession({ timestamp: Date.now() - SESSION_TTL_MS - 1000 }));
    expect(loadValidSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('sesja bez user_id → null i czyszczona', () => {
    saveSession({ timestamp: Date.now() });
    expect(loadValidSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('zepsuty JSON → null i czyszczony', () => {
    localStorage.setItem(SESSION_KEY, '{broken');
    expect(loadValidSession()).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('clearSession czyści klucz', () => {
    saveSession(makeSession());
    clearSession();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('generateOAuthState', () => {
  const realCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: realCrypto,
      configurable: true,
    });
  });

  it('używa crypto.getRandomValues → 32-znakowy hex', () => {
    const deterministic = new Uint8Array([
      0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
    ]);
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: (arr) => {
          arr.set(deterministic);
          return arr;
        },
      },
      configurable: true,
    });

    expect(generateOAuthState()).toBe('deadbeef0102030405060708090a0b0c');
  });

  it('fallback gdy crypto niedostępny — zwraca niepusty, unikalny nonce', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });

    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(5);
    expect(a).not.toBe(b);
  });
});
