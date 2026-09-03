/* src/Components/Auth/DiscordCallback.test.jsx
 *
 * Testy bramy CSRF (parametr state / nonce OAuth):
 *  - state z Discorda niezgodny z nonce z sessionStorage → logowanie
 *    zablokowane, zero fetchy, zero sesji w localStorage,
 *  - brak nonce (ręcznie otwarty URL z cudzym tokenem) → zablokowane,
 *  - zgodny state → przepuszcza do weryfikacji i konsumuje nonce.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '../../i18n.js';
import DiscordCallback from './DiscordCallback';
import { OAUTH_STATE_KEY } from '../../utils/session';

const setAuthHash = (stateVal) => {
  window.location.hash = `#/auth/callback#access_token=test_token&token_type=Bearer&state=${stateVal}`;
};

const renderCallback = () => {
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  render(<DiscordCallback />);
  return errSpy;
};

describe('DiscordCallback — ochrona CSRF (state nonce)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    window.location.hash = '#/';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('odrzuca logowanie, gdy state z Discorda nie zgadza się z nonce', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    sessionStorage.setItem(OAUTH_STATE_KEY, 'expected-nonce');
    setAuthHash('attacker-state');
    renderCallback();

    expect(await screen.findByText('AUTH_BLOCKED: OAUTH_STATE_MISMATCH')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('ZPK_auth_session')).toBeNull();
  });

  it('odrzuca logowanie przy braku nonce (ręcznie otwarty URL z cudzym tokenem)', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    setAuthHash('attacker-state');
    renderCallback();

    expect(await screen.findByText('AUTH_BLOCKED: OAUTH_STATE_MISMATCH')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('przepuszcza, gdy state się zgadza — i konsumuje nonce (one-time use)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('NETWORK_DOWN'));
    global.fetch = fetchMock;
    sessionStorage.setItem(OAUTH_STATE_KEY, 'expected-nonce');
    setAuthHash('expected-nonce');
    renderCallback();

    // Błąd sieci (celowo) — liczy się to, że doszło do weryfikacji Discorda
    expect(await screen.findByText('NETWORK_DOWN')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/users/@me',
      expect.anything()
    );
    expect(sessionStorage.getItem(OAUTH_STATE_KEY)).toBeNull();
  });
});
