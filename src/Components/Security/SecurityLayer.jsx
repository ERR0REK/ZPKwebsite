// src/Components/Security/SecurityLayer.jsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './Security.css';

const SecurityLayer = () => {
    const { t } = useTranslation();
    const [showAlert, setShowAlert] = useState(false);
    const [violationType, setViolationType] = useState('');

    const AUTHORIZED_ADMIN_ID = "687701665771814939";

    useEffect(() => {
        const checkBypass = () => {
            try {
                const session = JSON.parse(localStorage.getItem('ZPK_auth_session'));
                return session && session.user_id === AUTHORIZED_ADMIN_ID;
            } catch (e) {
                // Zepsuta sesja (np. ręczna edycja localStorage) — nie dajemy bypassu
                return false;
            }
        };

        const handleContextMenu = (e) => {
            if (checkBypass()) return;
            e.preventDefault();
            triggerAlert('UNAUTHORIZED_ACCESS_CONTEXT_MENU');
        };

        const handleKeyDown = (e) => {
            if (checkBypass()) return;
            // Block F12
            if (e.keyCode === 123) {
                e.preventDefault();
                triggerAlert('UNAUTHORIZED_HARDWARE_F12');
            }
            // Block Ctrl+Shift+I (Inspect)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
                e.preventDefault();
                triggerAlert('INSPECTION_BYPASS_DETECTED');
            }
            // Block Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
                e.preventDefault();
                triggerAlert('CONSOLE_MANIPULATION_ATTEMPT');
            }
            // Block Ctrl+U (View Source)
            if (e.ctrlKey && e.keyCode === 85) {
                e.preventDefault();
                triggerAlert('SOURCE_EXTRACTION_FAIL');
            }
        };

        const triggerAlert = (type) => {
            setViolationType(type);
            setShowAlert(true);
            setTimeout(() => setShowAlert(false), 3000);
        };

        window.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <AnimatePresence>
            {showAlert && (
                <motion.div
                    className="security-breach-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        className="security-alert-box"
                        initial={{ scale: 0.8, opacity: 0, y: -50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: -50 }}
                        transition={{ duration: 0.3, type: "spring", stiffness: 400 }}
                    >
                        {/* HUD Elements */}
                        <div className="s-tl"></div><div className="s-tr"></div>
                        <div className="s-bl"></div><div className="s-br"></div>

                        <div className="alert-header">
                            <ShieldAlert className="alert-icon" size={30} />
                            <div className="alert-title-main">{t('security.violation_title')}</div>
                        </div>

                        <div className="alert-content">
                            <div className="violation-label">
                                <Terminal size={12} />
                                <span>{violationType}</span>
                            </div>
                            <p className="alert-desc">
                                {t('security.unauthorized_access')}
                                <br />
                                <strong>{t('security.ip_logging')}</strong>
                            </p>
                        </div>

                        <div className="alert-footer">
                            <div className="scanning-bar"></div>
                            <span className="status-text">{t('security.status_text')}</span>
                        </div>
                    </motion.div>

                    {/* Glitch Overlay Effect */}
                    <div className="security-glitch-bg"></div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SecurityLayer;
