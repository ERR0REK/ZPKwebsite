/* src/Components/Pages/QA.jsx */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Terminal,
  Search,
  BookOpen
} from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import '../QA/QA.css';

const FAQItem = ({ question, answer, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      className={`qa-item ${isOpen ? 'active' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <button
        className="qa-question"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="q-tag">Q_{index + 1}</div>
        <span className="q-text">{question}</span>
        <div className="q-icon">
          {isOpen ? <ChevronUp /> : <ChevronDown />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="qa-answer-wrapper"
          >
            <div className="qa-answer">
              <div className="a-tag">SYSTEM_RESPONSE</div>
              <div className="a-content">{answer}</div>
              <div className="a-decoration"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="qa-glow"></div>
    </motion.div>
  );
};

export default function Qa() {
  const { t } = useTranslation();

  // FAQ Data - dynamically loaded from locales
  const faqs = t('qa.faqs', { returnObjects: true });

  return (
    <div className="qa-page">
      <Navbar />

      <div className="qa-overlay"></div>
      <div className="qa-scanlines"></div>

      {/* --- Hero Section --- */}
      <section className="qa-hero">
        <div className="hero-decoration">
          <Search size={16} />
          <span>KNOWLEDGE_BASE_v2.0</span>
          <Cpu size={16} />
        </div>
        <h1 className="qa-title glitch-text" data-text={t('qa.title', 'FAQ')}>
          {t('qa.title', 'FAQ')}
        </h1>
        <p className="qa-subtitle">
          {t('qa.subtitle', 'Najczęściej zadawane pytania i odpowiedzi dotyczące Zjednoczona Polska Korona')}
        </p>
        <div className="hero-divider">
          <span></span><Terminal size={20} /><span></span>
        </div>
      </section>

      {/* --- FAQ List --- */}
      <main className="qa-container">
        <div className="qa-list-header">
          <BookOpen size={20} />
          <h2>{t('qa.availableFaqs', 'DOSTĘPNE INFORMACJE')}</h2>
        </div>

        <div className="qa-faq-list">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              index={index}
            />
          ))}
        </div>
      </main>

      <footer className="qa-footer">
        <div className="footer-deco">
          <span></span><span></span><span></span>
        </div>
      </footer>
    </div>
  );
}