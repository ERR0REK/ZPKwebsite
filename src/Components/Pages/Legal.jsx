/* src/Components/Pages/Legal.jsx
 * Warunki Korzystania (Terms of Service) — transparentnie opisuje,
 * jakie dane zbiera autoryzacja przez Discorda i jak są używane.
 * Styl: taktyczny HUD spójny z resztą strony.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScrollText, ShieldCheck, Cpu, ArrowLeft } from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import './Legal.css';

const Terms = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = t('legal.terms.sections', { returnObjects: true });

  return (
    <div className="legal-page">
      <Navbar />
      <div className="legal-overlay"></div>
      <div className="legal-scanlines"></div>

      <section className="legal-hero">
        <div className="legal-decoration">
          <ScrollText size={16} />
          <span>LEGAL_PROTOCOL :: TERMS_OF_SERVICE</span>
          <ScrollText size={16} />
        </div>
        <h1 className="legal-title">{t('legal.terms.title', 'WARUNKI KORZYSTANIA')}</h1>
        <p className="legal-subtitle">{t('legal.terms.subtitle', 'Zasady korzystania z serwisu oraz przetwarzania danych')}</p>
      </section>

      <main className="legal-container">
        <button className="legal-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          <span>{t('legal.back', 'WRÓĆ')}</span>
        </button>

        <div className="legal-updated">
          <Cpu size={14} />
          <span>{t('legal.updatedAt', 'OSTATNIA AKTUALIZACJA')}: 2026-08-14</span>
        </div>

        <div className="legal-sections">
          {Array.isArray(sections) && sections.map((s, i) => (
            <motion.section
              key={i}
              className="legal-section"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="legal-section-header">
                <span className="legal-section-num">{String(i + 1).padStart(2, '0')}</span>
                <h2>{s.title}</h2>
              </div>
              {Array.isArray(s.body) ? (
                <div className="legal-section-body">
                  {s.body.map((p, j) => <p key={j}>{p}</p>)}
                </div>
              ) : (
                <div className="legal-section-body"><p>{s.body}</p></div>
              )}
            </motion.section>
          ))}
        </div>

        <div className="legal-notice">
          <ShieldCheck size={18} />
          <p>{t('legal.terms.notice', 'Jeśli masz pytania dotyczące tych warunków, skontaktuj się z administracją przez nasz serwer Discord.')}</p>
        </div>
      </main>
    </div>
  );
};

export default Terms;
