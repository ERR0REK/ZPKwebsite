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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
