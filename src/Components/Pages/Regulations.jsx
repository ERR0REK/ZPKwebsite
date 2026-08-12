// src/Components/Pages/Regulations.jsx

import React from 'react';
import { useTranslation } from 'react-i18next';

import Navbar from '../Navbar/Navbar';
import RegHeroSection from '../Regulations/RegHeroSection';
import RegWarningPanel from '../Regulations/RegWarningPanel';
import RegRuleCard from '../Regulations/RegRuleCard';
import '../Regulations/Regulations.css';

export default function Regulations() {
  const { t } = useTranslation();

  const generalRules = t('regulations.rules.general', { returnObjects: true });
  const voiceRules = t('regulations.rules.voice', { returnObjects: true });


  return (
    <div className="regulations-page">
      <Navbar />

      <div className="reg-overlay"></div>
      <div className="reg-scanlines"></div>

      <main className="reg-main-container">
        {/* --- Część przewijana --- */}
        <section className="reg-scrollable-part">
          <RegHeroSection />
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

            <footer className="reg-footer">
              <p>{t('regulations.footer.author')}</p>
              <p>{t('regulations.footer.updateDate')}</p>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}