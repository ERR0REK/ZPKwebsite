/* src/Components/Shared/ErrorBoundary.test.jsx
 *
 * Testy ErrorBoundary:
 *  - zdrowy komponent renderuje się normalnie (fallback niewidoczny),
 *  - zwykły błąd renderowania → ekran błędu z przyciskiem,
 *  - ChunkLoadError → automatyczny reload (tylko raz — flaga w sessionStorage).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const CHUNK_RELOAD_FLAG = 'ZPK_chunk_reload_attempted';

const Bomb = ({ error }) => {
  throw error;
};

const makeChunkError = () => {
  const err = new Error('Loading chunk 123 failed.');
  err.name = 'ChunkLoadError';
  return err;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renderuje dzieci, gdy nie ma błędu', () => {
    render(
      <ErrorBoundary>
        <div>OK_CONTENT</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('OK_CONTENT')).toBeTruthy();
    expect(screen.queryByText(/COŚ POSZŁO NIE TAK/)).toBeNull();
  });

  it('pokazuje ekran błędu przy zwykłym błędzie renderowania', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb error={new Error('render failure')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('COŚ POSZŁO NIE TAK')).toBeTruthy();
    expect(screen.getByText('PRZEŁADUJ STRONĘ')).toBeTruthy();
    spy.mockRestore();
  });

  it('przy ChunkLoadError robi automatyczny reload tylko raz', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom nie pozwala spyOn na location.reload — podmieniam cały location
    const reloadSpy = jest.fn();
    const realLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy, hash: '' },
      writable: true,
    });

    // Pierwszy błąd chunka → reload + flaga ustawiona
    const { unmount } = render(
      <ErrorBoundary>
        <Bomb error={makeChunkError()} />
      </ErrorBoundary>
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHUNK_RELOAD_FLAG)).toBe('1');

    // Po "reloadzie" (ponowny render) flaga jest ustawiona → fallback, bez reloadu
    unmount();
    render(
      <ErrorBoundary>
        <Bomb error={makeChunkError()} />
      </ErrorBoundary>
    );
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText('STRONA ZOSTAŁA ZAKTUALIZOWANA')).toBeTruthy();
    spy.mockRestore();
    Object.defineProperty(window, 'location', {
      value: realLocation,
      writable: true,
    });
  });
});
