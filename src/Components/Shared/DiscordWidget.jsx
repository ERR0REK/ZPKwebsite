/* src/Components/Shared/DiscordWidget.jsx
 * Widget Discorda — pokazuje liczbę członków online na serwerze.
 * Pobiera dane z publicznego API widgetu Discorda (bez tokena).
 * Fallback: gdy API nie odpowie, pokazuje "OFFLINE".
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Circle, ExternalLink, RefreshCw } from 'lucide-react';

// ID serwera Discord ZPK (oficjalny)
// Pobrane z widget URL: https://discord.com/api/guilds/{id}/widget.json
const GUILD_ID = '1445399610414858340';
const WIDGET_URL = `https://discord.com/api/guilds/${GUILD_ID}/widget.json`;
const INVITE_URL = 'https://discord.gg/A3wE5mGryB';
const REFRESH_INTERVAL = 60000; // 60 sekund

const DiscordWidget = () => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [now, setNow] = useState(Date.now());

    // Odświeżaj licznik "Xs temu" co 1s
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setRefreshing(true);
        try {
            const res = await fetch(WIDGET_URL);
            if (!res.ok) throw new Error('NOT_OK');
            const json = await res.json();
            setData(json);
            setError(false);
            setLastRefresh(Date.now());
        } catch (err) {
            setError(true);
        } finally {
            if (!silent) setRefreshing(false);
        }
    }, []);

    // Pierwsze pobranie + auto-refresh co 60s
    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    const presenceCount = data?.presence_count ?? 0;
    const memberCount = data?.member_count ?? 0;
    const online = presenceCount > 0;

    return (
        <motion.div
            className="discord-widget"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
        >
            <div className="discord-widget-header">
                <div className="discord-widget-title-group">
                    <Users size={14} />
                    <span className="discord-widget-tag">DISCORD_NETWORK</span>
                </div>
                <div className="discord-widget-controls">
                    <button
                        className="discord-refresh-btn"
                        onClick={() => fetchData()}
                        disabled={refreshing}
                        title="Odśwież dane"
                    >
                        <RefreshCw size={12} className={refreshing ? 'spin' : ''} />
                    </button>
                    <div className={`discord-widget-status ${online ? 'online' : 'offline'}`}>
                        <Circle size={8} fill="currentColor" />
                        <span>{error ? 'OFFLINE' : online ? 'LIVE' : 'NO_DATA'}</span>
                    </div>
                </div>
            </div>

            <div className="discord-widget-stats">
                <div className="discord-stat">
                    <span className="discord-stat-value">{error ? '—' : online ? presenceCount : '—'}</span>
                    <span className="discord-stat-label">ONLINE</span>
                </div>
                <div className="discord-stat-divider" />
                <div className="discord-stat">
                    <span className="discord-stat-value">{error ? '—' : memberCount > 0 ? memberCount : '—'}</span>
                    <span className="discord-stat-label">MEMBERS</span>
                </div>
            </div>

            <div className="discord-widget-right">
                <a
                    href={INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="discord-widget-join"
                >
                    <ExternalLink size={12} />
                    <span>DOŁĄCZ DO SERWERA</span>
                </a>
                {lastRefresh && (
                    <span className="discord-refresh-time">
                        Odświeżono: {Math.floor((now - lastRefresh) / 1000)}s temu
                    </span>
                )}
            </div>

            {/* HUD corners */}
            <div className="dw-corner tl" />
            <div className="dw-corner tr" />
            <div className="dw-corner bl" />
            <div className="dw-corner br" />
        </motion.div>
    );
};

export default DiscordWidget;
