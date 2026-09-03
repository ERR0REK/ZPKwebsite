/* src/Components/Shared/ErrorBoundary.jsx
 *
 * Globalna granica błędów aplikacji (montowana w index.js wokół <App />).
 *
 * Chroni przed "białym ekranem" w dwóch scenariuszach:
 *  1. Błąd w trakcie renderowania dowolnego komponentu → czytelny ekran
 *     z przyciskiem "Przeładuj" zamiast pustej strony.
 *  2. ChunkLoadError (lazy route po nowym deployu: przeglądarka trzyma
 *     stary index.html i woła usunięty chunk) → automatyczny reload RAZ;
 *     gdy to nie pomoże, pokazujemy ekran zamiast zapętlać odświeżanie.
 */

import React from 'react';
import './ErrorBoundary.css';

const CHUNK_RELOAD_FLAG = 'ZPK_chunk_reload_attempted';

const isChunkLoadError = (err) =>
  !!err &&
  (err.name === 'ChunkLoadError' || /Loading chunk \d+ failed/i.test(err.message || ''));

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[ErrorBoundary] Przechwycono błąd:', error);

    // ChunkLoadError = po deployu przeglądarka ma starą wersję strony.
    // Przeładuj raz (flaga w sessionStorage chroni przed pętlą reloadów).
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_FLAG)) {
      try {
        sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1');
      } catch (_) {
        /* ignore */
      }
      window.location.reload();
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.hash = '#/';
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);

    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-icon" aria-hidden="true">
            ⚠
          </div>
          <h1 className="error-boundary-title">
            {chunkError ? 'STRONA ZOSTAŁA ZAKTUALIZOWANA' : 'COŚ POSZŁO NIE TAK'}
          </h1>
          <p className="error-boundary-text">
            {chunkError
              ? 'Ładowałeś starszą wersję strony. Kliknij poniżej, aby pobrać aktualną.'
              : 'Wystąpił nieoczekiwany błąd. Odświeżenie strony zwykle pomaga.'}
          </p>
          {!chunkError && error && error.message ? (
            <code className="error-boundary-detail">{String(error.message).slice(0, 300)}</code>
          ) : null}
          <div className="error-boundary-actions">
            <button type="button" className="error-boundary-btn primary" onClick={this.handleReload}>
              PRZEŁADUJ STRONĘ
            </button>
            <button type="button" className="error-boundary-btn secondary" onClick={this.handleHome}>
              STRONA GŁÓWNA
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
