/* src/Components/Pages/Privacy.jsx
 * Polityka Prywatności — dokładnie opisuje, JAKIE dane zbiera
 * autoryzacja przez Discorda (logowanie na stronie), dlaczego,
 * gdzie są przechowywane i jak możesz je usunąć.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Cpu, ArrowLeft, Database, Eye, Trash2 } from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import './Legal.css';

const Privacy = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const sections = t('legal.privacy.sections', { returnObjects: true });

  const iconFor = (key) => {
    if (key === 'collect') return <Database size={15} />;
    if (key === 'purpose') return <Eye size={15} />;
    if (key === 'storage') return <Database size={15} />;
    if (key === 'delete') return <Trash2 size={15} />;
    return <Shield size={15} />;
  };

  return (
    <div className="legal-page">
      <Navbar />
      <div className="legal-overlay"></div>
      <div className="legal-scanlines"></div>

      <section className="legal-hero">
        <div className="legal-decoration">
          <Shield size={16} />
          <span>LEGAL_PROTOCOL :: PRIVACY_POLICY</span>
          <Shield size={16} />
        </div>
        <h1 className="legal-title">{t('legal.privacy.title', 'POLITYKA PRYWATNOŚCI')}</h1>
        <p className="legal-subtitle">{t('legal.privacy.subtitle', 'Jakie dane zbieramy, dlaczego i jak możesz je usunąć')}</p>
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

        {/* Najważniejsza sekcja: co NIE jest zbierane — na górze, wyróżniona */}
        <div className="legal-safe-box">
          <Shield size={20} />
          <div>
            <h3>{t('legal.privacy.safeTitle', 'CO NIGDY NIE JEST ZBIERANE')}</h3>
            <p>{t('legal.privacy.safeBody', 'Ta strona NIE zbiera Twojego hasła, adresu e-mail ani danych płatniczych. Logowanie przez Discorda używa bezpiecznego standardu OAuth — Discord nigdy nie udostępnia nam Twojego hasła.')}</p>
          </div>
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
                <span className="legal-section-icon">{iconFor(s.key)}</span>
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
          <Shield size={18} />
          <p>{t('legal.privacy.notice', 'Masz prawo w każdej chwili wylogować się i poprosić o usunięcie swoich danych — napisz do administracji na Discordzie.')}</p>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
