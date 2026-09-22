// src/Components/Navbar/Navbar.jsx

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, UserCircle, Wifi, WifiOff } from 'lucide-react';
import logo from '../../Assets/logo.png';
import { useRealtime } from '../../Realtime/RealtimeProvider';
import { useSession } from '../../Context/SessionContext';
import AnnounceBell from './AnnounceBell';
import './Navbar.css';

// Buduje URL avatara z Discorda (hash zapisany przy logowaniu).
const getAvatarUrl = (session) => {
  if (!session || !session.user_id || !session.avatar) return null;
  const ext = session.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${session.user_id}/${session.avatar}.${ext}?size=64`;
};

const Navbar = () => {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Sesja + licznik wygasania płyną z SessionContext — gdy TTL 12h
    // dobiegnie końca, provider czyści sesję i badge automatycznie znika
    // (użytkownik przestaje być zalogowany bez przeładowania strony).
    const { session, timeLeft, logout } = useSession();
    const location = useLocation();
    const realtime = useRealtime();

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    // Formatowanie pozostałego czasu: HH:MM:SS
    const formatTimeLeft = (ms) => {
        if (ms === null || ms === undefined) return '';
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    };

    const timeLeftMs = timeLeft ?? 0;
    const isLowTime = timeLeft !== null && timeLeftMs < 10 * 60 * 1000; // < 10 min → czerwony
    const avatarUrl = getAvatarUrl(session);

    return (
        <nav>
            <div className="nav-container">
                {/* --- LEWA STRONA (Logo i Nazwa) --- */}
                <div className="nav-left">
                    <NavLink to="/">
                        <img src={logo} alt={t('common.orgName')} className='logo' />
                    </NavLink>
                    <NavLink to="/" className='name'>
                        {t('common.orgName')}
                    </NavLink>
                </div>

                {/* --- HAMBURGER MENU (Mobile) --- */}
                <div className={`hamburger ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
                    <span className="bar"></span>
                    <span className="bar"></span>
                    <span className="bar"></span>
                </div>

                {/* --- PRAWA STRONA (Linki i Dropdown) --- */}
                <div className={`nav-right ${isMenuOpen ? 'active' : ''}`}>
                    <ul>
                        <li><NavLink to="/">{t('nav.home')}</NavLink></li>
                        <li><NavLink to="/about">{t('nav.about')}</NavLink></li>
                        <li><NavLink to="/regulations">{t('nav.regulations')}</NavLink></li>
                        <li><NavLink to="/qa">{t('nav.qa')}</NavLink></li>
                        <li><NavLink to="/staff">{t('nav.staff')}</NavLink></li>
                        <li><NavLink to="/history">{t('nav.history', 'HISTORIA')}</NavLink></li>
                        <li><NavLink to="/kos">{t('nav.kos', 'KOS')}</NavLink></li>
                        <li><NavLink to="/war-logs">{t('nav.warLogs', 'WAR LOGS')}</NavLink></li>
                        <li><NavLink to="/changelog" className="nav-changelog">{t('nav.changelog', 'CHANGELOG')}</NavLink></li>

                        {/* Globalny status realtime — LIVE / STANDBY */}
                        <li className="nav-realtime" title={realtime && realtime.isOnline
                            ? t('nav.realtimeOnline', 'REALTIME: ONLINE')
                            : realtime && realtime.isConnecting
                                ? t('nav.realtimeConnecting', 'REALTIME: CONNECTING...')
                                : (realtime && realtime.lastError
                                    ? t('nav.realtimeOfflineReason', 'REALTIME: OFFLINE') + ' — ' + realtime.lastError
                                    : t('nav.realtimeOffline', 'REALTIME: OFFLINE'))}>
                            {realtime && realtime.isOnline ? (
                                <Wifi size={13} className="rt-icon rt-online" />
                            ) : (
                                <WifiOff size={13} className="rt-icon rt-offline" />
                            )}
                            <span className={`rt-label ${realtime && realtime.isOnline ? 'rt-live' : 'rt-standby'}`}>
                                {realtime && realtime.isOnline ? t('nav.realtimeLive', 'LIVE') : t('nav.realtimeStandby', 'STANDBY')}
                            </span>
                        </li>

                        {/* Dzwonek ogłoszeń — historia + nadawanie (admini) */}
                        <li className="nav-bell-wrap">
                            <AnnounceBell />
                        </li>

                        {/* Zalogowany użytkownik — avatar + licznik + wylogowanie */}
                        {session && session.user_id && (
                            <li className="nav-session">
                                <span
                                    className={`nav-user-badge ${isLowTime ? 'low-time' : ''}`}
                                    title={t('nav.sessionBadge', 'ZALOGOWANO')}
                                >
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={session.username || 'avatar'} className="nav-avatar" />
                                    ) : (
                                        <UserCircle size={14} />
                                    )}
                                    <span className="nav-username">{session.username || 'OPERATIVE'}</span>
                                    {session.is_clan_member && (
                                        <span
                                            className="nav-clan-badge"
                                            title={t('nav.clanMemberBadge', 'CZŁONEK KLANU')}
                                        >
                                            {t('nav.clanMemberBadge', 'CZŁONEK KLANU')}
                                        </span>
                                    )}
                                    {timeLeft !== null && (
                                        <span className="nav-session-timer">
                                            {formatTimeLeft(timeLeftMs)}
                                        </span>
                                    )}
                                </span>
                                <button onClick={logout} className="nav-logout-btn" aria-label={t('nav.logout', 'LOGOUT')}>
                                    <LogOut size={14} />
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
