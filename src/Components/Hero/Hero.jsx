// src/Components/Hero/Hero.jsx

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
    MessageSquare,
    Terminal,
    Activity,
    ShieldCheck,
    Cpu,
    Wifi,
    Navigation,
    Target
} from 'lucide-react';
import LinkErrorModal from './LinkErrorModal';
import DecodedText from '../Shared/DecodedText';
import heroBg from '../../Assets/976320.jpg';
import CyberParticles from './CyberParticles';
import LiveTerminal from './LiveTerminal';
import '../Hero/Hero.css';

const Hero = () => {
    const { t } = useTranslation();
    const [isErrorOpen, setIsErrorOpen] = useState(false);
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [bootSequence, setBootSequence] = useState(0);

    // Parallax Motion Values
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth transition springs
    const springConfig = { stiffness: 100, damping: 30 };
    const smX = useSpring(mouseX, springConfig);
    const smY = useSpring(mouseY, springConfig);

    // Dynamic transforms for different layers
    const bgX = useTransform(smX, [-500, 500], [15, -15]);
    const bgY = useTransform(smY, [-500, 500], [15, -15]);
    const hudX = useTransform(smX, [-500, 500], [-25, 25]);
    const hudY = useTransform(smY, [-500, 500], [-25, 25]);
    const textX = useTransform(smX, [-500, 500], [-10, 10]);
    const textY = useTransform(smY, [-500, 500], [-10, 10]);

    useEffect(() => {
        const handleMouseMove = (e) => {
            const { clientX, clientY } = e;
            const moveX = clientX - window.innerWidth / 2;
            const moveY = clientY - window.innerHeight / 2;
            mouseX.set(moveX);
            mouseY.set(moveY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        
        const timer1 = setTimeout(() => setBootSequence(1), 500);
        const timer2 = setTimeout(() => setBootSequence(2), 1000);
        const timer3 = setTimeout(() => setBootSequence(3), 1500);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [mouseX, mouseY]);

    const links = {
        discord: 'https://discord.gg/A3wE5mGryB',
    };

    const handleLinkDispatch = (platform) => {
        const url = links[platform];
        if (url && url !== '') {
            window.open(url, '_blank');
        } else {
            setSelectedPlatform(platform);
            setIsErrorOpen(true);
        }
    };

    return (
        <div className='hero'>
            <CyberParticles />
            
            {/* Background Layer with Parallax */}
            <motion.div 
                className="hero-bg-container"
                style={{ 
                    backgroundImage: `url(${heroBg})`,
                    x: bgX,
                    y: bgY,
                    scale: 1.1
                }}
            >
                <div className="hero-image-overlay"></div>
            </motion.div>

            <div className="hero-grid-overlay"></div>
            <div className="hero-scanline"></div>

            {/* --- Targeting Reticle Decoration --- */}
            <div className="reticle-container">
                <motion.div 
                    className="targeting-reticle"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                    <Target size={400} strokeWidth={0.5} opacity={0.1} />
                </motion.div>
                <motion.div 
                    className="targeting-reticle-inner"
                    animate={{ rotate: -360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                >
                    <Target size={250} strokeWidth={1} opacity={0.05} />
                </motion.div>
            </div>

            {/* --- HUD Corners with Parallax --- */}
            <motion.div className="hud-panel hud-tl" style={{ x: hudX, y: hudY }}>
                <div className="hud-line"></div>
                <div className="hud-data">
                    <div className="data-item">
                        <Activity size={12} />
                        <span>SYSTEM: ONLINE</span>
                    </div>
                    <div className="data-item">
                        <Cpu size={12} />
                        <span>LOAD: 12%</span>
                    </div>
                </div>
            </motion.div>

            <motion.div className="hud-panel hud-tr" style={{ x: hudX, y: hudY }}>
                <div className="hud-line"></div>
                <div className="hud-data">
                    <div className="data-item">
                        <ShieldCheck size={12} />
                        <span>CLEARANCE: LVL_4</span>
                    </div>
                    <div className="data-item status-verified">
                        <Wifi size={12} />
                        <span>LINK: SECURE</span>
                    </div>
                </div>
            </motion.div>

            <LiveTerminal />

            <div className="container">
                <motion.div
                    className="hero-text"
                    style={{ x: textX, y: textY }}
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <motion.div
                        className="hero-tagline"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: bootSequence >= 1 ? 1 : 0 }}
                    >
                        <Terminal size={14} />
                        <span>FACTION_MAIN_TERMINAL_v4.0.1</span>
                    </motion.div>

                    <h1 className="glitch-text">
                        <DecodedText text={t('hero.title')} delay={1} />
                    </h1>

                    <motion.div
                        className="hero-desc-wrapper"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: bootSequence >= 3 ? 1 : 0, y: bootSequence >= 3 ? 0 : 20 }}
                    >
                        <div className="bio-border"></div>
                        <p>{t('hero.welcome')}</p>
                    </motion.div>

                    <motion.div
                        className="hero-buttons-group"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: bootSequence >= 3 ? 1 : 0 }}
                    >
                        <motion.button 
                            className='btn btn-discord' 
                            onClick={() => handleLinkDispatch('discord')}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <MessageSquare size={18} />
                            <span>{t('hero.discord_button')}</span>
                        </motion.button>
                    </motion.div>
                </motion.div>
            </div>

            {/* --- Mission Ticker --- */}
            <div className="mission-ticker">
                <div className="ticker-label">
                    <Navigation size={14} />
                    <span>LIVE_OS_INTEL</span>
                </div>
                <div className="ticker-content">
                    <div className="ticker-track">
                        <span>{t('ticker.line1')}</span>
                        <span>{t('ticker.line2')}</span>
                        <span>{t('ticker.line3')}</span>
                        <span>{t('ticker.line4')}</span>
                        <span>{t('ticker.line5')}</span>
                        <span>{t('ticker.line1')}</span>
                        <span>{t('ticker.line2')}</span>
                        <span>{t('ticker.line3')}</span>
                        <span>{t('ticker.line4')}</span>
                        <span>{t('ticker.line5')}</span>
                    </div>
                </div>
            </div>

            <LinkErrorModal
                isOpen={isErrorOpen}
                onClose={() => setIsErrorOpen(false)}
                platform={selectedPlatform}
            />
        </div>
    );
};

export default Hero;