/* src/Components/Home/ActivityFeed.jsx
 * Live activity feed — pokazuje na stronie głównej wydarzenia na żywo:
 * zmiany w KOS, nowe raporty wojenne, ogłoszenia.
 *
 * Fallback: gdy realtime nie działa (lokalny dev / brak klucza), feed
 * pokazuje ostatnie wydarzenia z danych lokalnych (kosTargets.json +
 * warLogs.json), żeby sekcja nigdy nie była pusta.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Skull, Sword, Megaphone, Radio, ShieldAlert, Activity } from 'lucide-react';
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

const seedFromLocalData = (t) => {
  const items = [];
  const personal = Array.isArray(kosTargets.personal) ? kosTargets.personal : [];
  const factions = Array.isArray(kosTargets.factions) ? kosTargets.factions : [];
  const warLogs = Array.isArray(warLogsData.logs) ? warLogsData.logs : [];

  personal.slice(0, 2).forEach((p) => {
    if (p && p.name) {
      items.push({
        id: `seed-kos-${p.name}`,
        type: 'kos',
        title: t('home.feed.kosAdded', 'CEL KOS DODANY'),
        message: p.name,
        timestamp: Date.now()
      });
    }
  });
  factions.slice(0, 1).forEach((f) => {
    if (f && f.name) {
      items.push({
        id: `seed-fac-${f.name}`,
        type: 'kos',
        title: t('home.feed.factionAdded', 'KLAN DODANY DO KOS'),
        message: f.name,
        timestamp: Date.now()
      });
    }
  });
  warLogs.slice(0, 2).forEach((w) => {
    if (w && w.opponent) {
      items.push({
        id: `seed-war-${w.opponent}`,
        type: 'war',
        title: t('home.feed.warReport', 'RAPORT WOJENNY'),
        message: w.opponent,
        timestamp: Date.now()
      });
    }
  });
  return items;
};

export const ActivityFeed = () => {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const [items, setItems] = useState([]);

  // Start z danymi lokalnymi (fallback + pierwszy render)
  useEffect(() => {
    setItems(seedFromLocalData(t));
  }, [t]);

  // Live — subskrybuj kanały KOS, wojen i ogłoszeń
  useEffect(() => {
    if (!realtime || !realtime.subscribe) return;

    const handlers = [
      ['zpk-kos-updates', (msg) => {
        const d = msg.data || {};
        if (!d.name) return;
        setItems((prev) => [{
          id: `kos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          id: `war-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
          {isLive ? 'LIVE' : 'STANDBY'}
        </span>
      </div>

      {sorted.length > 0 ? (
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
