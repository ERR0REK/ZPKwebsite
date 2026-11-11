/* src/Components/Auth/DiscordCallback.test.jsx
 *
 * Testy Implicit Flow:
 *  - brak access_token w hashu → błąd NO_TOKEN_IN_HASH
 *  - poprawny access_token → weryfikacja użytkownika na Discord API
 *  - błąd sieci przy weryfikacji → wyświetlenie błędu
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '../../i18n.js';
import DiscordCallback from './DiscordCallback';

const setAuthHash = (fragment) => {
  window.location.hash = `#${fragment}`;
};

const renderCallback = () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<DiscordCallback />);
  return errSpy;
};

describe('DiscordCallback — Implicit Flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/auth/callback';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('odrzuca logowanie, gdy brak access_token w hashu (tylko /auth/callback)', async () => {
    window.location.hash = '#/auth/callback';
    renderCallback();

    expect(await screen.findByText('AUTHENTICATION_FAILED: NO_TOKEN_IN_HASH')).toBeTruthy();
    expect(localStorage.getItem('ZPK_auth_session')).toBeNull();
  });

  it('odrzuca logowanie, gdy hash jest pusty', async () => {
    window.location.hash = '';
    renderCallback();

    expect(await screen.findByText('AUTHENTICATION_FAILED: NO_TOKEN_IN_HASH')).toBeTruthy();
  });

  it('weryfikuje użytkownika na Discord API przy poprawnym access_token', async () => {
    const fetchMock = jest.fn()
      // 1. users/@me
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: '123456789', username: 'TestUser', avatar: null, global_name: null })
      })
      // 2. users/@me/guilds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: '1445399610414858340' }, { id: '1368589684858683453' }]
      });
    global.fetch = fetchMock;

    setAuthHash('access_token=valid_token&token_type=Bearer&expires_in=604800&scope=identify%20guilds');
    renderCallback();

    // Czekaj na sukces (redirect po 1200ms)
    await act(async () => {
      await new Promise(r => setTimeout(r, 1300));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/users/@me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer valid_token' }
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/users/@me/guilds',
      expect.objectContaining({
        headers: { Authorization: 'Bearer valid_token' }
      })
    );
    expect(localStorage.getItem('ZPK_auth_session')).not.toBeNull();
  });

  it('obsługuje błąd sieci przy weryfikacji', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('NETWORK_DOWN'));
    global.fetch = fetchMock;

    setAuthHash('access_token=valid_token&token_type=Bearer&expires_in=604800&scope=identify%20guilds');
    renderCallback();

    // Po błędzie sieci powinno pokazać error
    expect(await screen.findByText('NETWORK_DOWN')).toBeTruthy();
  });
});