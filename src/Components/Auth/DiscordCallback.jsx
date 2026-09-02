/* src/Components/Auth/DiscordCallback.jsx
 *
 * WAŻNE: ten komponent NIE używa react-router (renderowany poza Routerem,
 * gdy hash zawiera access_token). Przekierowanie robi przez window.location,
 * żeby App.jsx mógł poprawnie przełączyć się na główny Router.
 *
 * Naprawione:
 *  - "NO_TOKEN_RECEIVED" po poprawnym logowaniu — gdy sesja już istnieje
 *    w localStorage, przekierowujemy zamiast pokazywać błąd.
 *  - Po sukcesie następuje PELNE odświeżenie strony z czystym URL —
 *    App czyta hash bez tokena i wchodzi do głównego routera.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Terminal, Cpu } from 'lucide-react';
import LoadingScreen from '../LoadingScreen/LoadingScreen';
import { isDevSite } from '../../utils/siteEnv';
import { readSession } from '../../utils/session';
import './DiscordCallback.css';

const REQUIRED_GUILD_ID = process.env.REACT_APP_GUILD_ID || "1445399610414858340";
const REQUIRED_DEV_GUILD_ID = process.env.REACT_APP_DEV_GUILD_ID || "1368589684858683453";

// Czyści access_token z hash i robi pełny redirect na czysty URL.
const cleanAndRedirect = (target) => {
  const base = window.location.origin + window.location.pathname;
  window.history.replaceState(null, null, base + "#/" + target);
  // Pełne odświeżenie — App ponownie czyta hash (bez tokena) i montuje główny router.
  window.location.reload();
};

const DiscordCallback = () => {
    const { t } = useTranslation();
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('verifying'); // verifying, success, error

    useEffect(() => {
        const handleAuth = async () => {
            // Because of HashRouter, the URL looks like #/auth/callback#access_token=...
            // e.g. https://site/#/auth/callback#access_token=xxx&token_type=Bearer
            const fragments = window.location.hash.split('#');
            const authHash = fragments[fragments.length - 1];
            const params = new URLSearchParams(authHash);
            const accessToken = params.get('access_token');

            // --- Przypadek 1: brak tokena w URL ---
            if (!accessToken) {
                const session = readSession();
                // User jest już zalogowany (sesja w localStorage) — np. odświeżył
                // stronę z resztkami access_token w hash albo wraca na /auth/callback.
                // Przekieruj do celu zamiast pokazywać błąd.
                if (session && session.user_id) {
                    const redirectTarget = sessionStorage.getItem('ZPK_redirect_target') || '/';
                    sessionStorage.removeItem('ZPK_redirect_target');
                    cleanAndRedirect(redirectTarget.replace(/^#?\//, ''));
                    return;
                }
                setError("AUTHENTICATION_FAILED: NO_TOKEN_RECEIVED");
                setStatus('error');
                return;
            }

            // --- Przypadek 2: token jest — weryfikacja ---
            try {
                // 1. Fetch user's profile to get their ID
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (!userResponse.ok) throw new Error(t('login.error_api'));
                const userData = await userResponse.json();

                // 2. Fetch user's guilds to verify membership
                const response = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (!response.ok) throw new Error(t('login.error_api'));

                const guilds = await response.json();
                const isInMainGuild = guilds.some(g => g.id === REQUIRED_GUILD_ID);
                const isInDevGuild = guilds.some(g => g.id === REQUIRED_DEV_GUILD_ID);

                // Na domenie dev wymagamy wyłącznie członkostwa w serwerze
                // deweloperskim. Na produkcji wymagamy obu serwerów.
                const devSite = isDevSite();
                const hasAccess = devSite ? isInDevGuild : (isInMainGuild && isInDevGuild);

                if (hasAccess) {
                    // Check admin role (via Netlify Function + Discord bot)
                    let is_admin = false;
                    try {
                        const adminRes = await fetch('/api/verify-admin', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ access_token: accessToken })
                        });
                        const adminData = await adminRes.json();
                        is_admin = !!(adminData && adminData.ok && adminData.is_admin);
                    } catch (e) {
                        // If the function is not deployed yet, default to non-admin
                        is_admin = false;
                    }

                    // Store session with user ID, admin flag, membership flags
                    localStorage.setItem('ZPK_auth_session', JSON.stringify({
                        access_token: accessToken,
                        user_id: userData.id,
                        username: userData.username || userData.global_name || null,
                        // Hash avatara z Discorda — do zbudowania URL-a CDN:
                        // https://cdn.discordapp.com/avatars/{id}/{hash}.png
                        avatar: userData.avatar || null,
                        is_admin,
                        is_dev_member: isInDevGuild,
                        is_main_member: isInMainGuild,
                        timestamp: Date.now()
                    }));

                    setStatus('success');

                    // Retrieve the redirect target or default to home
                    const redirectTarget = sessionStorage.getItem('ZPK_redirect_target') || "/";
                    sessionStorage.removeItem('ZPK_redirect_target');

                    // Czysty redirect + pełne odświeżenie — dzięki temu App.jsx
                    // przechodzi do głównego routera i /kos jest osiągalne.
                    setTimeout(() => {
                        cleanAndRedirect(redirectTarget.replace(/^#?\//, ''));
                    }, 1200);
                } else {
                    setStatus('error');
                    setError(devSite ? t('login.error_no_dev_server') : t('login.error_no_server'));
                    localStorage.removeItem('ZPK_auth_session');
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
                setError(err.message || t('login.error_api'));
            }
        };

        handleAuth();
    }, [t]);

    return (
        <div className="auth-callback-page">
            <div className="auth-callback-glow"></div>

            <AnimatePresence mode="wait">
                {status === 'verifying' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <LoadingScreen />
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        key="success"
                        className="auth-status-card success"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <CheckCircle2 className="auth-icon" size={60} />
                        <h2 className="auth-title">{t('login.success_title')}</h2>
                        <p className="auth-body">{t('login.success_body')}</p>
                        <div className="auth-status">
                            <Cpu size={14} className="spinning-icon" />
                            <span>{t('login.redirecting')}</span>
                        </div>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        key="error"
                        className="auth-status-card error"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                    >
                        <ShieldAlert className="auth-icon" size={60} />
                        <h2 className="auth-title">{error}</h2>
                        <div className="auth-status">
                            <Terminal size={12} />
                            <span>AUTH_PROTOCOL_TERMINATED_BY_SECURITY</span>
                        </div>
                        <button
                            className="auth-return-btn"
                            onClick={() => window.location.href = window.location.origin + "/#/"}
                        >
                            Return to Login
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DiscordCallback;
