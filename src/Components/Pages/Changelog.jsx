/* src/Components/Pages/Changelog.jsx */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Bug,
  Zap,
  ShieldCheck,
  FileText,
  Rocket,
  Cpu,
  ChevronRight,
  ChevronDown,
  Info,
  Lock
} from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import { useSession } from '../../Context/SessionContext';
import '../Changelog/Changelog.css';

export default function Changelog() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();

  // WERSJE DEV są chronione jak DevGuard — dostęp mają tylko członkowie
  // serwera deweloperskiego (is_dev_member). Dla reszty zakładka DEV
  // pokazuje blokadę, a domyślnie otwiera się zakładka STABILNE.
  const isDevMember = !!(session && session.user_id && session.is_dev_member === true);

  const [expandedVersion, setExpandedVersion] = useState(null);
  const [activeCategory, setActiveCategory] = useState(() => (isDevMember ? 'dev' : 'release'));
  const [devVersions, setDevVersions] = useState([]);
  const [releaseVersions, setReleaseVersions] = useState([]);

  // Load versions from i18n on mount and language change
  useEffect(() => {
    const devData = i18n.getResourceBundle(i18n.language, 'translation')?.changelog?.dev;
    const releaseData = i18n.getResourceBundle(i18n.language, 'translation')?.changelog?.release;

    if (Array.isArray(devData)) setDevVersions(devData);
    if (Array.isArray(releaseData)) setReleaseVersions(releaseData);
  }, [i18n.language, i18n]);

  const currentVersions = activeCategory === 'dev' ? devVersions : releaseVersions;

  // Zalogowanie przez Discorda (ten sam flow co LoginPage) — po powrocie
  // z OAuth sesja ma is_dev_member i zakładka DEV się odblokowuje.
  const handleDiscordLogin = () => {
    const DISCORD_CLIENT_ID = '1448793452044222586';
    const REDIRECT_URI = encodeURIComponent(window.location.origin + '/#/auth/callback');
    window.location.href =
      `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}` +
      `&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds`;
  };

  const getIcon = (type) => {
    switch (type) {
      case 'feature': return <Sparkles className="icon-main" />;
      case 'bugfix': return <Bug className="icon-main" />;
      case 'improvement': return <Zap className="icon-main" />;
      case 'security': return <ShieldCheck className="icon-main" />;
      case 'info': return <Info className="icon-main" />;
      default: return <FileText className="icon-main" />;
    }
  };

  return (
    <div className="changelog-page">
      <Navbar />

      <div className="changelog-overlay"></div>
      <div className="changelog-scanlines"></div>

      {/* Hero Section */}
      <section className="changelog-hero">
        <div className="hero-decoration-top">
          <span className="line"></span>
          <span className="tag">DATABASE_LOGS</span>
          <span className="line"></span>
        </div>
        <h1 className="changelog-title glitch-text" data-text={t('changelog.title', 'CHANGELOG')}>
          {t('changelog.title', 'CHANGELOG')}
        </h1>
        <p className="changelog-subtitle">
          {t('changelog.subtitle', 'See the history of changes and updates to Zjednoczona Polska Korona')}
        </p>
      </section>

      {/* Category Tabs */}
      <section className="changelog-tabs">
        <button
          className={`tab-button ${activeCategory === 'dev' ? 'active' : ''}`}
          onClick={() => setActiveCategory('dev')}
        >
          <div className="tab-glow"></div>
          <Cpu className="tab-icon" />
          <span className="tab-label">{t('changelog.tabs.dev', 'DEV Versions')}</span>
        </button>
        <button
          className={`tab-button ${activeCategory === 'release' ? 'active' : ''}`}
          onClick={() => setActiveCategory('release')}
        >
          <div className="tab-glow"></div>
          <Rocket className="tab-icon" />
          <span className="tab-label">{t('changelog.tabs.release', 'Release Versions')}</span>
        </button>
      </section>

      {/* Changelog Timeline — WERSJE DEV chronione (DevGuard) */}
      <main className="changelog-container">
        {activeCategory === 'dev' && !isDevMember ? (
          <div className="changelog-dev-lock">
            <div className="dev-lock-corner tl"></div>
            <div className="dev-lock-corner tr"></div>
            <div className="dev-lock-corner bl"></div>
            <div className="dev-lock-corner br"></div>

            <Lock size={44} className="dev-lock-icon" />
            <h3 className="dev-lock-title">
              {t('changelog.devLocked.title', 'DEV_ACCESS_REQUIRED')}
            </h3>
            <p className="dev-lock-desc">
              {t('changelog.devLocked.desc')}
            </p>
            <button className="dev-lock-login" onClick={handleDiscordLogin}>
              <span>{t('changelog.devLocked.login', 'Zaloguj się przez Discord')}</span>
            </button>
            <div className="dev-lock-hint">AUTH_PROTOCOL_TERMINATED_BY_SECURITY</div>
          </div>
        ) : (
          <div className="changelog-timeline">
            {currentVersions.map((entry, index) => (
              <motion.div
                key={entry.version}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.5 }}
                className={`changelog-entry-wrapper ${expandedVersion === entry.version ? 'expanded' : ''}`}
              >
                <div
                  className={`changelog-entry ${entry.type || activeCategory}`}
                  onClick={() => setExpandedVersion(expandedVersion === entry.version ? null : entry.version)}
                >
                  <div className="entry-header">
                    <div className="version-tag">
                      <span className="v-label">VER</span>
                      <span className="v-num">{entry.version}</span>
                    </div>

                    <div className="version-info">
                      <span className="version-date">{entry.date}</span>
                      <span className={`version-type-badge ${entry.type || activeCategory}`}>
                        {t(`changelog.badges.${entry.type || activeCategory}`, (entry.type || activeCategory).toUpperCase())}
                      </span>
                    </div>

                    <div className="expand-indicator">
                      {expandedVersion === entry.version ? <ChevronDown /> : <ChevronRight />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedVersion === entry.version && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="changelog-details"
                      >
                        <div className="details-inner">
                          <div className="corner tl"></div>
                          <div className="corner tr"></div>
                          <div className="corner bl"></div>
                          <div className="corner br"></div>

                          <div className="changes-list">
                            {entry.changes.map((change, changeIndex) => (
                              <motion.div
                                key={changeIndex}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: changeIndex * 0.1 }}
                                className={`change-item type-${change.type}`}
                              >
                                <div className="change-icon-box">
                                  {getIcon(change.type)}
                                </div>
                                <div className="change-content">
                                  <h3 className="change-title">{change.title}</h3>
                                  <p className="change-description">{change.description}</p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="entry-background"></div>
                  <div className="entry-scanner"></div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="changelog-footer">
          <div className="footer-line"></div>
          <div className="footer-content">
            <p className="footer-thanks">{t('changelog.footer.thankYou', 'Thank you for following our development!')}</p>
            <p className="footer-discord">{t('changelog.footer.suggest', 'Have suggestions? Join our Discord!')}</p>
          </div>
          <div className="footer-decoration">
            <span></span><span></span><span></span>
          </div>
        </footer>
      </main>
    </div>
  );
}
