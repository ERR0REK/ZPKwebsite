/* src/Components/Home/ActivityFeed.jsx
 * Live activity feed — pokazuje na stronie głównej wydarzenia na żywo:
 * zmiany w KOS, nowe raporty wojenne, ogłoszenia.
 *
 * Na starcie pobiera AKTUALNE dane z chmury (/api/kos-store, /api/war-store),
 * żeby feed pokazywał prawdziwą ostatnią aktywność, a nie statyczne dane z JSON.
 * Realtime (Ably) dopisuje nowe wydarzenia na żywo.
 * Fallback: gdy API nie odpowiada, używa danych z kosTargets.json + warLogs.json.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Skull, Sword, Megaphone, Radio, ShieldAlert, Activity, Loader2 } from 'lucide-react';
import { useRealtime } from '../../Realtime/RealtimeProvider';
import './ActivityFeed.css';
import kosTargets from '../../data/kosTargets.json';
import warLogsData from '../../data/warLogs.json';

const MAX_ITEMS = 8;

const iconFor = (type) => {
  if (type === 'kos') return <Skull size={14} />;
  if (type === 'war') return <Sword size={14} />;
  if (type === 'announcement') return <Megaphone size={14} />;
  return <Activity size={14} />;
};

// Fallback seed z plików JSON (gdy API nie działa)
const seedFromLocalData = (t) => {
  const items = [];
  const personal = Array.isArray(kosTargets.personal) ? kosTargets.personal : [];
  const factions = Array.isArray(kosTargets.factions) ? kosTargets.factions : [];
  const warLogs = Array.isArray(warLogsData.logs) ? warLogsData.logs : [];

  // Ostatnie 3 cele osobowe (z timestampem "dawnym" by były na dole)
  personal.slice(-3).reverse().forEach((p, idx) => {
    if (p && p.name) {
      items.push({
        id: `seed-kos-${p.name}`,
        type: 'kos',
        title: t('home.feed.kosAdded', 'CEL KOS DODANY'),
        message: p.name,
        timestamp: Date.now() - (1000 * 60 * 60 * 24 * (idx + 1)) // symulacja dawności
      });
    }
  });
  // Ostatnie 2 klany
  factions.slice(-2).reverse().forEach((f, idx) => {
    if (f && f.name) {
      items.push({
        id: `seed-fac-${f.name}`,
        type: 'kos',
        title: t('home.feed.factionAdded', 'KLAN DODANY DO KOS'),
        message: f.name,
        timestamp: Date.now() - (1000 * 60 * 60 * 24 * (idx + 4))
      });
    }
  });
  // Ostatnie 3 raporty wojenne
  warLogs.slice(-3).reverse().forEach((w, idx) => {
    if (w && w.opponent) {
      items.push({
        id: `seed-war-${w.opponent}`,
        type: 'war',
        title: t('home.feed.warReport', 'RAPORT WOJENNY'),
        message: w.opponent,
        timestamp: Date.now() - (1000 * 60 * 60 * 24 * (idx + 1))
      });
    }
  });
  return items;
};

// Buduje itemy feedu z PRAWDZIWYCH danych chmury (z timestampami z danych jeśli są)
const buildItemsFromCloud = (t, kosData, warData) => {
  const items = [];
  const now = Date.now();

  // KOS personal - bierzemy ostatnie 3 (posortowane po nazwie w API, więc nie mamy daty dodania)
  // Używamy malejących timestampów by nowe były na górze
  (kosData?.personal || []).slice(-3).reverse().forEach((p, idx) => {
    if (p && p.name) {
      items.push({
        id: `kos-${p.name}`,
        type: 'kos',
        title: t('home.feed.kosAdded', 'CEL KOS DODANY'),
        message: p.name,
        timestamp: now - idx * 1000 // rozrzut timestampów
      });
    }
  });
  // KOS factions
  (kosData?.factions || []).slice(-2).reverse().forEach((f, idx) => {
    if (f && f.name) {
      items.push({
        id: `kos-fac-${f.name}`,
        type: 'kos',
        title: t('home.feed.factionAdded', 'KLAN DODANY DO KOS'),
        message: f.name,
        timestamp: now - (idx + 3) * 1000
      });
    }
  });
  // War Logs - tu MAMY datę w danych! Używamy jej do sortowania
  const sortedLogs = [...(warData?.logs || [])].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da; // najnowsze pierwsze
  });
  sortedLogs.slice(0, 3).forEach((w, idx) => {
    if (w && w.opponent) {
      const logTime = new Date(w.date || now).getTime();
      items.push({
        id: `war-${w.id || w.opponent}`,
        type: 'war',
        title: t('home.feed.warReport', 'RAPORT WOJENNY'),
        message: w.opponent,
        timestamp: logTime || (now - idx * 1000)
      });
    }
  });

  return items;
};

export const ActivityFeed = () => {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pobierz AKTUALNE dane z chmury przy starcie
  const fetchCloudData = useCallback(async () => {
    try {
      const [kosRes, warRes] = await Promise.all([
        fetch('/api/kos-store').catch(() => null),
        fetch('/api/war-store').catch(() => null)
      ]);

      const kosData = kosRes?.ok ? await kosRes.json().catch(() => null) : null;
      const warData = warRes?.ok ? await warRes.json().catch(() => null) : null;

      if (kosData?.ok && warData?.ok) {
        // SUKCES: zbuduj feed z PRAWDZIWYCH danych chmury
        setItems(buildItemsFromCloud(t, kosData, warData));
      } else {
        // FALLBACK: API nie zadziałało - użyj statycznych danych z JSON
        setItems(seedFromLocalData(t));
      }
    } catch (err) {
      console.warn('[ActivityFeed] Cloud fetch failed, using local seed:', err);
      setItems(seedFromLocalData(t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Initial load - pobierz dane z chmury
  useEffect(() => {
    fetchCloudData();
  }, [fetchCloudData]);

  // Live — subskrybuj kanały KOS, wojen i ogłoszeń
  useEffect(() => {
    if (!realtime || !realtime.subscribe) return;

    const handlers = [
      ['zpk-kos-updates', (msg) => {
        const d = msg.data || {};
        if (!d.name) return;
        setItems((prev) => [{
          id: `kos-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'kos',
          title: d.action === 'removed'
            ? t('home.feed.kosRemoved', 'CEL KOS USUNIĘTY')
            : t('home.feed.kosAdded', 'CEL KOS DODANY'),
          message: d.name,
          timestamp: Date.now()
        }, ...prev].slice(0, MAX_ITEMS));
      }],
      ['zpk-war-status', (msg) => {
        const d = msg.data || {};
        if (!d.name) return;
        setItems((prev) => [{
          id: `war-live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'war',
          title: t('home.feed.warReport', 'RAPORT WOJENNY'),
          message: d.name,
          timestamp: Date.now()
        }, ...prev].slice(0, MAX_ITEMS));
      }],
      ['zpk-announcements', (msg) => {
        const d = msg.data || {};
        if (!d.message) return;
        setItems((prev) => [{
          id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: 'announcement',
          title: d.title || t('home.feed.announcement', 'OGŁOSZENIE'),
          message: d.message,
          timestamp: Date.now()
        }, ...prev].slice(0, MAX_ITEMS));
      }]
    ];

    const unsubs = handlers.map(([channel, cb]) => realtime.subscribe(channel, cb));
    return () => unsubs.forEach((u) => u && u());
  }, [realtime, t]);

  const isLive = realtime && realtime.isOnline;

  const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
  };

  const sorted = useMemo(
    () => [...items].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, MAX_ITEMS),
    [items]
  );

  return (
    <section className="feed-section">
      <div className="feed-header">
        <div className="feed-title-group">
          <Radio size={16} className={isLive ? 'feed-live-dot' : ''} />
          <h2>{t('home.feed.title', 'AKTYWNOŚĆ FRAKCJI')}</h2>
        </div>
        <span className={`feed-status ${isLive ? 'live' : 'standby'}`}>
          {loading ? (
            <>
              <Loader2 size={12} className="feed-loading-spinner" />
              ŁADOWANIE...
            </>
          ) : isLive ? 'LIVE' : 'STANDBY'}
        </span>
      </div>

      {loading ? (
        <div className="feed-loading">
          <Loader2 size={24} className="feed-loading-spinner" />
          <span>{t('home.feed.loading', 'POBIERANIE AKTYWNOŚCI Z CHMURY...')}</span>
        </div>
      ) : sorted.length > 0 ? (
        <div className="feed-list">
          {sorted.map((item, i) => (
            <motion.div
              key={item.id}
              className={`feed-item type-${item.type}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <div className="feed-item-icon">{iconFor(item.type)}</div>
              <div className="feed-item-body">
                <span className="feed-item-title">{item.title}</span>
                <span className="feed-item-message">{item.message}</span>
              </div>
              <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="feed-empty">
          <ShieldAlert size={20} />
          <span>{t('home.feed.empty', 'BRAK AKTYWNOŚCI — SYSTEM W STANDBY')}</span>
        </div>
      )}
    </section>
  );
};

export default ActivityFeed;
