/* src/Components/Pages/NotFound.jsx */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Cpu, ShieldAlert } from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import DecodedText from '../Shared/DecodedText';
import './NotFound.css';

const NotFound = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <div className="nf-page">
            <Navbar />

            <div className="nf-overlay"></div>
            <div className="nf-scanlines"></div>

            <motion.section
                className="nf-container"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="nf-decoration">
                    <Cpu size={16} className="nf-hero-icon" />
                    <span className="nf-tag">ERROR_404 :: ROUTE_NOT_FOUND</span>
                    <Cpu size={16} className="nf-hero-icon" />
                </div>

                <motion.div
                    className="nf-code glitch-text"
                    data-text="404"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                >
                    <DecodedText text="404" delay={0.3} />
                </motion.div>

                <h1 className="nf-title">
                    {t('notFound.title', 'ZAGUBIONY W PRZESTRZENI')}
                </h1>
                <p className="nf-subtitle">
                    {t('notFound.subtitle', 'Szukany sektor nie istnieje lub został przesunięty do innego układu współrzędnych.')}
                </p>

                <div className="nf-status-box">
                    <ShieldAlert size={20} />
                    <span>{t('notFound.status', 'STATUS: SYGNAŁ NIEODNALEZIONY')}</span>
                </div>

                <motion.button
                    className="nf-home-btn"
                    whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(239, 68, 68, 0.4)" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/')}
                >
                    <div className="nf-btn-glow"></div>
                    <Home size={18} />
                    <span>{t('notFound.backHome', 'WRÓĆ DO BAZY')}</span>
                </motion.button>

                <div className="nf-coords">
                    <span>X: UNKNOWN</span>
                    <span>Y: UNKNOWN</span>
                    <span>Z: VOID</span>
                </div>
            </motion.section>
        </div>
    );
};

export default NotFound;
