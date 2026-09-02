// src/Components/Navbar/AnnounceBell.jsx
//
// 🔔 Dzwonek ogłoszeń w navbarze:
//  - Dla WSZYSTKICH: historia ostatnich ogłoszeń (z Netlify Blobs przez
//    funkcję /api/announce-history — GET, rate limited).
//  - Dla ADMINÓW: formularz nadawania nowego ogłoszenia bezpośrednio
//    ze strony (POST /api/announce — weryfikacja roli po stronie serwera).

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Megaphone, X, Send, Loader2 } from 'lucide-react';
import { useRealtime } from '../../Realtime/RealtimeProvider';
import { useSession } from '../../Context/SessionContext';

const SEVERITIES = ['info', 'warning', 'critical'];

const AnnounceBell = () => {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Reaktywna sesja — po wygaśnięciu TTL przycisk admina znika od razu.
  const { session } = useSession();

  // Formularz nadawania (tylko admini)
  const [composing, setComposing] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', severity: 'info' });

  const ref = useRef(null);

  // Zamknij dropdown po kliknięciu na zewnątrz
  useEffect(() => {
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const isAdmin = !!(session && session.is_admin);

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/announce-history');
      const data = await res.json();
      if (res.ok && data && data.ok) {
        setHistory(Array.isArray(data.history) ? data.history : []);
      } else {
        setError(data && data.error ? data.error : 'HISTORY_UNAVAILABLE');
      }
    } catch (err) {
      setError('HISTORY_UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && history.length === 0) loadHistory();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/announce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session?.access_token,
          title: form.title.trim(),
          message: form.message.trim(),
          severity: form.severity
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError((data && data.error) || 'ANNOUNCE_FAILED');
        return;
      }
      // Sukces — wyczyść formularz, odśwież historię, pokaż toast
      setForm({ title: '', message: '', severity: 'info' });
      setComposing(false);
      loadHistory();
      if (realtime && typeof realtime.pushToast === 'function') {
        realtime.pushToast({
          type: 'announcement',
          title: t('nav.bell.sent', 'OGŁOSZENIE WYSŁANE'),
          message: form.title || form.message.slice(0, 80),
          severity: 'info'
        });
      }
    } catch (err) {
      setError('ANNOUNCE_FAILED');
    } finally {
      setSending(false);
    }
  };

  const severityClass = (sev) => `bell-sev-${sev || 'info'}`;

  return (
    <div className="announce-bell" ref={ref}>
      <button
        className={`bell-btn ${open ? 'active' : ''}`}
        onClick={handleOpen}
        aria-label={t('nav.bell.label', 'OGŁOSZENIA')}
        title={t('nav.bell.label', 'OGŁOSZENIA')}
      >
        <Bell size={16} />
        {!open && history.length > 0 && (
          <span className="bell-dot"></span>
        )}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-header">
            <Megaphone size={14} />
            <span>{t('nav.bell.title', 'OGŁOSZENIA FRAKCJI')}</span>
          </div>

          {/* Nadawanie (tylko admini) */}
          {isAdmin && !composing && (
            <button className="bell-compose-btn" onClick={() => setComposing(true)}>
              <Send size={13} />
              <span>{t('nav.bell.compose', 'NOWE OGŁOSZENIE')}</span>
            </button>
          )}

          {isAdmin && composing && (
            <form className="bell-form" onSubmit={handleSend}>
              <input
                type="text"
                className="bell-input"
                placeholder={t('nav.bell.titlePlaceholder', 'TYTUŁ (opcjonalnie)')}
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={80}
              />
              <textarea
                className="bell-textarea"
                placeholder={t('nav.bell.messagePlaceholder', 'TREŚĆ OGŁOSZENIA...')}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                maxLength={500}
                rows={3}
                required
              />
              <div className="bell-form-row">
                <select
                  className="bell-severity"
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                >
                  {SEVERITIES.map((sev) => (
                    <option key={sev} value={sev}>
                      {t(`nav.bell.severity.${sev}`, sev.toUpperCase())}
                    </option>
                  ))}
                </select>
                <button type="submit" className="bell-send-btn" disabled={sending || !form.message.trim()}>
                  {sending ? <Loader2 size={13} className="spin" /> : <Send size={13} />}
                  <span>{t('nav.bell.send', 'WYŚLIJ')}</span>
                </button>
                <button type="button" className="bell-cancel-btn" onClick={() => setComposing(false)}>
                  <X size={13} />
                </button>
              </div>
            </form>
          )}

          {error && <div className="bell-error">{error}</div>}

          {/* Historia */}
          <div className="bell-list">
            {loading ? (
              <div className="bell-loading">{t('nav.bell.loading', 'ŁADOWANIE...')}</div>
            ) : history.length === 0 ? (
              <div className="bell-empty">{t('nav.bell.empty', 'BRAK OGŁOSZEŃ')}</div>
            ) : (
              history.map((item, i) => (
                <div key={i} className={`bell-item ${severityClass(item.severity)}`}>
                  <div className="bell-item-title">
                    <span className="bell-item-sev">{item.severity ? item.severity.toUpperCase() : 'INFO'}</span>
                    <span className="bell-item-heading">{item.title || t('nav.bell.anonymous', 'OGŁOSZENIE')}</span>
                  </div>
                  <div className="bell-item-message">{item.message}</div>
                  <div className="bell-item-meta">
                    {item.timestamp && new Date(item.timestamp).toLocaleString()}
                    {item.author ? ` :: ${item.author}` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnounceBell;
