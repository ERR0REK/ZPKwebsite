/* src/Components/Pages/About.jsx */

import React from 'react';
import { useTranslation } from 'react-i18next';
import Navbar from '../Navbar/Navbar';
import '../About/About.css';
import { motion } from 'framer-motion';
import {
  Target,
  Shield,
  Users,
  Zap,
  Trophy,
  Cpu,
  Radio,
  Globe,
  Terminal,
  MessageSquare,
  Gamepad2,
  ClipboardList
} from 'lucide-react';

export default function About() {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <div className="about-page">
      <Navbar />

      <div className="about-overlay"></div>
      <div className="about-scanlines"></div>

      {/* --- Hero Section --- */}
      <motion.section
        className="about-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="hero-decoration">
          <Terminal size={16} className="hero-icon" />
          <span className="hero-tag">FACTION_MANIFESTO</span>
        </div>
        <motion.h1
          className="about-title glitch-text"
          data-text={t('about.title')}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          {t('about.title')}
        </motion.h1>
        <motion.p
          className="about-subtitle"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {t('about.subtitle')}
        </motion.p>
        <div className="hero-divider">
          <span></span><Cpu size={20} /><span></span>
        </div>
      </motion.section>

      {/* --- Main Content --- */}
      <motion.main
        className="about-container"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >
        {/* Kim jesteśmy? */}
        <motion.section className="about-card" variants={sectionVariants}>
          <div className="card-header">
            <Users className="card-icon" />
            <h2 className="card-title">{t('about.whoAreWe')}</h2>
          </div>
          <div className="card-body">
            <p>{t('about.whoAreWeContent')}</p>
            <p>{t('about.whoAreWeContent2')}</p>
          </div>
          <div className="card-scanner"></div>
          <div className="corner tl"></div><div className="corner tr"></div>
          <div className="corner bl"></div><div className="corner br"></div>
        </motion.section>

        {/* Nasza misja */}
        <motion.section className="about-card highlight" variants={sectionVariants}>
          <div className="card-header">
            <Target className="card-icon" />
            <h2 className="card-title">{t('about.ourMission')}</h2>
          </div>
          <div className="card-body">
            <p>{t('about.ourMissionContent')}</p>
            <div className="features-grid">
              {[1, 2, 3, 4].map((num) => (
                <motion.div key={num} className="feature-item" variants={itemVariants}>
                  <Zap size={18} className="feature-icon" />
                  <span>{t(`about.mission${num}`)}</span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="card-scanner"></div>
          <div className="corner tl"></div><div className="corner tr"></div>
          <div className="corner bl"></div><div className="corner br"></div>
        </motion.section>

        {/* Wymagania */}
        <motion.section className="about-card highlight" variants={sectionVariants}>
          <div className="card-header">
            <ClipboardList className="card-icon" />
            <h2 className="card-title">{t('about.requirementsTitle')}</h2>
          </div>
          <div className="card-body">
            <p>{t('about.requirementsIntro')}</p>
            <div className="features-grid">
              {[1, 2, 3].map((num) => (
                <motion.div key={num} className="feature-item" variants={itemVariants}>
                  <Shield size={18} className="feature-icon" />
                  <span>{t(`about.requirement${num}`)}</span>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="card-scanner"></div>
          <div className="corner tl"></div><div className="corner tr"></div>
          <div className="corner bl"></div><div className="corner br"></div>
        </motion.section>

        {/* Wartości */}
        <motion.section className="about-card" variants={sectionVariants}>
          <div className="card-header">
            <Shield className="card-icon" />
            <h2 className="card-title">{t('about.values')}</h2>
          </div>
          <div className="card-body">
            <p className="intro-text">{t('about.valuesIntro')}</p>
            <div className="values-list">
              {[1, 2, 3, 4, 5].map((num) => (
                <motion.div key={num} className="value-entry" variants={itemVariants}>
                  <div className="value-header">
                    <Radio size={16} />
                    <span className="value-title">{t(`about.value${num}Title`)}</span>
                  </div>
                  <p className="value-desc">{t(`about.value${num}Content`)}</p>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="card-scanner"></div>
          <div className="corner tl"></div><div className="corner tr"></div>
          <div className="corner bl"></div><div className="corner br"></div>
        </motion.section>

        {/* Struktura */}
        <motion.section className="about-card" variants={sectionVariants}>
          <div className="card-header">
            <Globe className="card-icon" />
            <h2 className="card-title">{t('about.structure')}</h2>
          </div>
          <div className="card-body">
            <p>{t('about.structureContent')}</p>
            <p>{t('about.structureContent2')}</p>
          </div>
          <div className="card-scanner"></div>
          <div className="corner tl"></div><div className="corner tr"></div>
          <div className="corner bl"></div><div className="corner br"></div>
        </motion.section>

        {/* Kontakt i Dołącz */}
        <motion.section className="about-card join-card" variants={sectionVariants}>
          <div className="card-header">
            <MessageSquare className="card-icon" />
            <h2 className="card-title">{t('about.howToJoin')}</h2>
          </div>
          <div className="card-body join-layout">
            <div className="join-info">
              <p>{t('about.howToJoinContent')}</p>
              
              <div className="join-steps-list">
                {[1, 2, 3, 4].map((num) => (
                  <motion.div key={num} className="step-item" variants={itemVariants}>
                    <div className="step-number">{num}</div>
                    <span>{t(`about.step${num}`)}</span>
                  </motion.div>
                ))}
              </div>

              <motion.button
                className="join-btn"
                whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(0, 255, 102, 0.4)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.open('https://discord.gg/your-link', '_blank')}
              >
                <div className="btn-glow"></div>
                <span>{t('about.joinDiscord')}</span>
              </motion.button>

              {/* Community + Klan: alternatywa dla osób, które nie chcą dołączać do klanu */}
              <div className="community-block">
                <h3 className="community-title">{t('about.communityTitle')}</h3>
                <p className="community-content">{t('about.communityContent')}</p>
                <div className="community-steps-list">
                  {[1, 2, 3].map((num) => (
                    <motion.div key={num} className="community-step" variants={itemVariants}>
                      <div className="community-step-num">{num}</div>
                      <span>{t(`about.communityStep${num}`)}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="contact-info">
              <h3 className="contact-title">{t('about.contact')}</h3>
              <div className="contact-links">
                <div className="link-item">
                  <Terminal size={14} />
                  <span>{t('about.contactDiscord')}</span>
                </div>
                <div className="link-item">
                  <Gamepad2 size={14} />
                  <span>{t('about.contactRoblox')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="card-scanner"></div>
          <div className="corner tl"></div><div className="corner tr"></div>
          <div className="corner bl"></div><div className="corner br"></div>
        </motion.section>
      </motion.main>

      <footer className="about-footer">
        <div className="footer-decoration">
          <span></span><Trophy size={18} /><span></span>
        </div>
      </footer>
    </div>
  );
}