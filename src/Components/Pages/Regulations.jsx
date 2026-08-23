// src/Components/Pages/Regulations.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

import Navbar from '../Navbar/Navbar';
import RegHeroSection from '../Regulations/RegHeroSection';
import RegWarningPanel from '../Regulations/RegWarningPanel';
import RegRuleCard from '../Regulations/RegRuleCard';
import '../Regulations/Regulations.css';

export default function Regulations() {
  const { t } = useTranslation();
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [copied, setCopied] = useState(false);

  const generalRules = t('regulations.rules.general', { returnObjects: true });
  const voiceRules = t('regulations.rules.voice', { returnObjects: true });

  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleCopy = useCallback(() => {
    const allRules = [
      t('regulations.generalRulesTitle'),
      ...generalRules.map((r, i) => `${i + 1}. ${r}`),
      '',
      t('regulations.voiceChatRulesTitle'),
      ...voiceRules.map((r, i) => `${i + 1}. ${r}`)
    ].join('\n');
    navigator.clipboard.writeText(allRules).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [t, generalRules, voiceRules]);

  return (
    <div className="regulations-page">
      <Navbar />

      <div className="reg-overlay"></div>
      <div className="reg-scanlines"></div>

      <main className="reg-main-container">
        {/* --- Część przewijana --- */}
        <section className="reg-scrollable-part">
          <RegHeroSection />

          {/* QoL Buttons */}
          <div className="reg-qol-buttons">
            <button className="reg-qol-btn" onClick={() => window.print()}>
              <span className="qol-icon">🖨️</span>
              <span>DRUKUJ REGULAMIN</span>
            </button>
            <button className="reg-qol-btn" onClick={handleCopy}>
              <span className="qol-icon">📋</span>
              <span>{copied ? 'SKOPIOWANO!' : 'KOPIUJ REGULAMIN'}</span>
            </button>
          </div>

          <RegWarningPanel />
        </section>

        {/* --- Część "lepka" (z dodatkowym wrapperem) --- */}
        <section className="reg-sticky-part">
          {/* Nowy wrapper dla efektów wizualnych */}
          <div className="reg-sticky-content">
            <div className="rules-container">
              <RegRuleCard
                title={t('regulations.generalRulesTitle')}
                rules={generalRules}
                delay={0.2}
                number="01"
              />
              <RegRuleCard
                title={t('regulations.voiceChatRulesTitle')}
                rules={voiceRules}
                delay={0.4}
                number="02"
              />
            </div>

            {/* Links to Privacy + Terms */}
            <div className="reg-legal-links">
              <Link to="/privacy" className="reg-legal-link">
                <span className="reg-legal-icon">🔒</span>
                <span>{t('login.privacy', 'Polityka Prywatności')}</span>
              </Link>
              <Link to="/terms" className="reg-legal-link">
                <span className="reg-legal-icon">📜</span>
                <span>{t('login.tos', 'Warunki Korzystania')}</span>
              </Link>
            </div>

            <footer className="reg-footer">
              <p>{t('regulations.footer.author')}</p>
              <p>{t('regulations.footer.updateDate')}</p>
            </footer>
          </div>
        </section>
      </main>

      {/* Back to Top */}
      {showTopBtn && (
        <button className="reg-back-to-top" onClick={scrollToTop} title="Powrót na górę">
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}