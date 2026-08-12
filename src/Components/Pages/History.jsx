/* src/Components/Pages/History.jsx */

import React from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../Navbar/Navbar';
import { motion } from 'framer-motion';
import {
    //Calendar,
    History as HistoryIcon,
    //Search,
    Sword,
    Shield,
    Flag,
    Target,
    //Terminal,
    Cpu
} from 'lucide-react';
import DecodedText from '../Shared/DecodedText';
import './History.css';

const History = () => {
    const { t } = useTranslation();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -50 },
        visible: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.6, ease: "easeOut" }
        }
    };

    const timelineEvents = [
        {
            year: "2023_Q3",
            title: t('history.event1.title', 'INITIATION_PROTOCOL'),
            content: t('history.event1.content', 'The first division was formed under the codename Zjednoczona Polska Korona. The goal: Unity and tactical dominance.'),
            icon: <Flag size={20} />
        },
        {
            year: "2023_Q4",
            title: t('history.event2.title', 'FIRST_DEPLOYMENT'),
            content: t('history.event2.content', 'Engagement in the first major operation. Significant victory achieved through coordinated drone strikes.'),
            icon: <Sword size={20} />
        },
        {
            year: "2024_Q1",
            title: t('history.event3.title', 'FORTIFICATION_PHASE'),
            content: t('history.event3.content', 'Expansion of the digital database and recruitment of elite specialists.'),
            icon: <Shield size={20} />
        },
        {
            year: "2024_PRESENT",
            title: t('history.event4.title', 'COMMAND_ASCENSION'),
            content: t('history.event4.content', 'Modernization of the Web-Command interface and full integration with Global Intelligence Networks.'),
            icon: <Target size={20} />
        }
    ];

    return (
        <div className="history-page">
            <Navbar />

            <div className="history-overlay"></div>
            <div className="history-scanlines"></div>

            {/* Hero Section */}
            <section className="history-hero">
                <div className="hero-decoration">
                    <HistoryIcon size={16} className="hero-icon" />
                    <span className="hero-tag">TIMELINE_ARCHIVE</span>
                </div>
                <h1 className="history-title glitch-text" data-text={t('history.title', 'FACTION HISTORY')}>
                    <DecodedText text={t('history.title', 'FACTION HISTORY')} delay={0.2} />
                </h1>
                <p className="history-subtitle">
                    {t('history.subtitle', 'Official chronological records of Zjednoczona Polska Korona operations.')}
                </p>
                <div className="hero-divider">
                    <span></span><Cpu size={20} /><span></span>
                </div>
            </section>

            {/* Timeline Section */}
            <motion.main
                className="history-container"
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.1 }}
            >
                {/* No central line anymore, badge is on the left */}
                {timelineEvents.map((event, index) => (
                    <motion.div
                        key={index}
                        className="timeline-item"
                        variants={itemVariants}
                    >
                        <div className="timeline-badge">
                            <div className="badge-outer">
                                {event.icon}
                            </div>
                        </div>

                        <div className="timeline-card">
                            <div className="card-header">
                                <span className="card-year">{event.year}</span>
                                <h3 className="card-title">{event.title}</h3>
                            </div>
                            <div className="card-body">
                                <p>{event.content}</p>
                            </div>

                            {/* HUD Elements */}
                            <div className="card-scanner"></div>
                            <div className="corner tl"></div><div className="corner tr"></div>
                            <div className="corner bl"></div><div className="corner br"></div>
                        </div>
                    </motion.div>
                ))}
            </motion.main>

            <footer className="history-footer">
                <div className="footer-line"></div>
                <div className="footer-tag">RECORDS_LOCKED_v3.5 :: COMMAND_LEVEL_CLEARANCE</div>
            </footer>
        </div>
    );
};

export default History;
