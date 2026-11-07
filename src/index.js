/* src/index.js */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n.js';
import ErrorBoundary from './Components/Shared/ErrorBoundary';

// === BLOCK INSPECT ELEMENT (CZĘŚCIOWO) ===
// Wyłącza otwarcie DevTools F12, Ctrl+Shift+I, Ctrl+Shift+K, Ctrl+Shift+J
// Ostrzeżenie: Zaawansowani użytkownicy mogą obejść to w konsoli
if (process.env.NODE_ENV === 'production') {
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+K
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }
  });

  // Wyłącz inspect element na prawe kliknięcie (context menu)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Ably v2: przy StrictMode double-mount pierwsza instancja jest zamykana,
// zanim dokończy CONNECTING — maszyna stanów SDK odrzuca wtedy Promise
// ("Connection closed") i to ląduje jako unhandledrejection (czerwony overlay
// w dev, szum dla użytkownika). try/catch tego nie łapie (asynchroniczne).
// Nasycone filtrujemy wyłącznie ten znany przypadek, reszta przechodzi normalnie.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event && event.reason && (event.reason.message || String(event.reason));
  if (msg && msg.includes('Connection closed')) {
    event.preventDefault();
    console.debug('[Realtime] zamknięcie niedokończonego połączenia Ably (StrictMode) — ignorowane');
    // Overlay webpack-dev-server reaguje na unhandledrejection niezależnie
    // (jego handler rejestruje się wcześniej i preventDefault go nie blokuje),
    // więc jeśli w overlay jest wyłącznie ten znany, nieszkodliwy przypadek —
    // zamykamy go. Prawdziwe błędy zostają nietknięte.
    try {
      const overlay = document.getElementById('webpack-dev-server-client-overlay');
      if (overlay) {
        const text = overlay.contentDocument
          ? overlay.contentDocument.body.innerText
          : '';
        const errors = (text.match(/ERROR/g) || []).length;
        const known = (text.match(/Connection closed/g) || []).length;
        if (errors > 0 && errors === known) {
          overlay.remove();
        }
      }
    } catch (e) {
      /* overlay niedostępny — nic to nie zmienia */
    }
  }
});

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
