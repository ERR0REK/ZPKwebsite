/* src/Components/Auth/LoginPage.jsx */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Lock,
    ShieldAlert,
    Info,
    Cpu,
    CheckCircle2
} from 'lucide-react';
import logo from '../../Assets/logo.png';
import './LoginPage.css';

const LoginPage = ({ devMode }) => {
    const { t } = useTranslation();

    // Discord Configuration (Placeholder - User needs to fill this in)
    const DISCORD_CLIENT_ID = "1448793452044222586";
    const REDIRECT_URI = encodeURIComponent(window.location.origin + "/#/auth/callback");

    // For implicit flow:
    const DISCORD_AUTH_URL = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds`;

    const handleLogin = () => {
        window.location.href = DISCORD_AUTH_URL;
    };

    return (
        <div className="login-page">
            <div className="login-overlay"></div>
            <div className="login-scanlines"></div>

            <motion.div
                className="login-container"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <div className="login-card">
                    {/* HUD Elements */}
                    <div className="corner tl"></div><div className="corner tr"></div>
                    <div className="corner bl"></div><div className="corner br"></div>
                    <div className="card-scanner"></div>

                    <div className="login-header">
                        <img src={logo} alt="Logo" className="login-logo" />
                        <h1 className="login-title">Zjednoczona Polska Korona</h1>
                        <div className="security-status">
                            <Lock size={14} />
                            <span>SECURE_GATEWAY_v4.2</span>
                        </div>
                    </div>

                    <div className="login-body">
                        {devMode && (
                            <div className="dev-login-warning">
                                <ShieldAlert size={16} />
                                <span>{t('login.dev_warning', 'WERSJA DEWELOPERSKA — dostęp tylko dla członków serwera deweloperskiego frakcji.')}</span>
                            </div>
                        )}
                        <h2 className="login-prompt">
                            {t('login.prompt', 'LOGIN_TO_CONTINUE')}
                        </h2>
                        <p className="login-subtitle">
                            {t('login.subtitle', 'Please authorize your account to access the tactical dashboard.')}
                        </p>

                        <button className="discord-login-btn" onClick={handleLogin}>
                            <div className="btn-glow"></div>
                            <img src="https://assets-global.website-files.com/6257adef93867e3d03ca4052/6257adef93867e61ba405380_discord-icon.svg" alt="Discord" />
                            <span>{t('login.with_discord', 'LOGIN_WITH_DISCORD')}</span>
                        </button>

                        <div className="membership-requirements">
                            <div className="req-header">
                                <Info size={16} />
                                <span>{t('login.requirements_title', 'ENTRY_REQUIREMENTS')}</span>
                            </div>
                            <ul className="req-list">
                                <li>
                                    <CheckCircle2 size={14} className="req-icon" />
                                    <span>{t('login.req1', 'Valid Discord Account')}</span>
                                </li>
                                <li>
                                    <CheckCircle2 size={14} className="req-icon" />
                                    <span>{t('login.req2', 'Membership in official ZPK Server')}</span>
                                </li>
                                <li>
                                    <CheckCircle2 size={14} className="req-icon" />
                                    <span>{t('login.req3', 'Verified Identity Status')}</span>
                                </li>
                            </ul>

                            <div className="req-notice">
                                <ShieldAlert size={14} />
                                <p>{t('login.notice', 'Discord login is required to verify your operative status and clear your session.')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="login-footer">
                        <div className="footer-links">
                            <a href="#/terms" className="footer-link-static">{t('login.tos', 'Terms of Service')}</a>
                            <span className="dot"></span>
                            <a href="#/privacy" className="footer-link-static">{t('login.privacy', 'Privacy Policy')}</a>
                        </div>
                        <div className="system-load">
                            <Cpu size={12} />
                            <span>SYSTEM_READY: AUTH_REQUIRED</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default LoginPage;
