/* src/Components/Auth/DiscordCallback.jsx */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle2, Terminal, Cpu } from 'lucide-react';
import LoadingScreen from '../LoadingScreen/LoadingScreen';

const DiscordCallback = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('verifying'); // verifying, success, error

    const REQUIRED_GUILD_ID = "1445399610414858340"; // Main Faction Server
    const REQUIRED_DEV_GUILD_ID = "1368589684858683453"; // Dev Server ID (Placeholder - Update if needed)

    useEffect(() => {
        const handleAuth = async () => {
            // Because of HashRouter, the URL looks like #/auth/callback#access_token=...
            const fragments = window.location.hash.split('#');
            const authHash = fragments[fragments.length - 1];
            const params = new URLSearchParams(authHash);
            const accessToken = params.get('access_token');

            if (!accessToken) {
                setError("AUTHENTICATION_FAILED: NO_TOKEN_RECEIVED");
                return;
            }

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

                if (isInMainGuild && isInDevGuild) {
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

                    // Store session with user ID and admin flag
                    localStorage.setItem('ZPK_auth_session', JSON.stringify({
                        access_token: accessToken,
                        user_id: userData.id,
                        is_admin,
                        timestamp: Date.now()
                    }));

                    setStatus('success');

                    // Retrieve the redirect target or default to home
                    const redirectTarget = sessionStorage.getItem('ZPK_redirect_target') || "/";
                    sessionStorage.removeItem('ZPK_redirect_target');

                    // Clear the Discord fragment and redirect
                    setTimeout(() => {
                        window.history.replaceState(null, null, window.location.origin + window.location.pathname + "#" + redirectTarget);
                        navigate(redirectTarget);
                    }, 1500);
                } else {
                    setStatus('error');
                    setError(t('login.error_no_server'));
                    localStorage.removeItem('ZPK_auth_session');
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
                setError(err.message || t('login.error_api'));
            }
        };

        handleAuth();
    }, [navigate, t]);

    return (
        <div className="auth-callback-page" style={{
            background: '#0a0a0a',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Tactical Decorations */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'radial-gradient(circle at center, transparent 0%, rgba(0,255,102,0.05) 100%)',
                pointerEvents: 'none'
            }}></div>

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
                        className="auth-status-card"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{
                            background: 'rgba(15, 20, 15, 0.95)',
                            border: '1px solid #00ff66',
                            padding: '40px',
                            textAlign: 'center',
                            position: 'relative',
                            maxWidth: '450px',
                            width: '90%',
                            boxShadow: '0 0 30px rgba(0, 255, 102, 0.2)',
                            zIndex: 10
                        }}
                    >
                        <CheckCircle2 color="#00ff66" size={60} style={{ marginBottom: '20px' }} />
                        <h2 style={{ color: '#00ff66', fontFamily: 'Orbitron, sans-serif', marginBottom: '15px', textTransform: 'uppercase' }}>{t('login.success_title')}</h2>
                        <p style={{ color: '#fff', opacity: 0.8, marginBottom: '25px', fontFamily: 'Chakra Petch' }}>{t('login.success_body')}</p>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#00ff66', fontSize: '0.8rem', fontFamily: 'Chakra Petch' }}>
                            <Cpu size={14} className="spinning-icon" />
                            <span>{t('login.redirecting')}</span>
                        </div>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        key="error"
                        className="auth-status-card"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        style={{
                            background: 'rgba(20, 10, 10, 0.95)',
                            border: '1px solid #ff3333',
                            padding: '40px',
                            textAlign: 'center',
                            position: 'relative',
                            maxWidth: '450px',
                            width: '90%',
                            boxShadow: '0 0 30px rgba(255, 51, 51, 0.2)',
                            zIndex: 10
                        }}
                    >
                        <ShieldAlert color="#ff3333" size={60} style={{ marginBottom: '20px' }} />
                        <h2 style={{ color: '#ff3333', fontFamily: 'Orbitron, sans-serif', marginBottom: '15px', textTransform: 'uppercase' }}>{error}</h2>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#ff3333', fontSize: '0.7rem', marginBottom: '30px', opacity: 0.6, fontFamily: 'Chakra Petch' }}>
                            <Terminal size={12} />
                            <span>AUTH_PROTOCOL_TERMINATED_BY_SECURITY</span>
                        </div>

                        <button
                            onClick={() => window.location.href = window.location.origin + "/#/"}
                            style={{
                                background: 'transparent',
                                border: '1px solid #ff3333',
                                color: '#ff3333',
                                padding: '12px 30px',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                fontFamily: 'Orbitron, sans-serif',
                                transition: 'all 0.3s'
                            }}
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
