/* src/Components/Pages/QA.jsx */

import React, { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Terminal,
  Search,
  BookOpen,
  Copy,
  Check,
  ChevronsUpDown,
  X
} from 'lucide-react';
import Navbar from '../Navbar/Navbar';
import '../QA/QA.css';

const FAQItem = ({ question, answer, index, isOpen, onToggle }) => {
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef(null);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard API może być zablokowana — fallback na execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = answer;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => setCopied(false), 2000);
      } catch (err2) {
        // zupełny brak dostępu do schowka — ignoruj
      }
    }
  };

  return (
    <motion.div
      className={`qa-item ${isOpen ? 'active' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
    >
      <button
        className="qa-question"
        onClick={onToggle}
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
              <button
                className={`a-copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                aria-label={copied ? 'Skopiowano' : 'Kopiuj odpowiedź'}
                title={copied ? 'Skopiowano!' : 'Kopiuj odpowiedź'}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
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
  const [search, setSearch] = useState('');
  const [openIndexes, setOpenIndexes] = useState(new Set());

  // Filtrowanie po wyszukiwarce (pytanie + odpowiedź, bez rozróżniania wielkości liter)
  const faqs = useMemo(() => {
    const allFaqs = t('qa.faqs', { returnObjects: true });
    const list = Array.isArray(allFaqs) ? allFaqs : [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (faq) =>
        (faq.question || '').toLowerCase().includes(q) ||
        (faq.answer || '').toLowerCase().includes(q)
    );
  }, [t, search]);

  const allOpen = faqs.length > 0 && openIndexes.size === faqs.length;

  const toggleAll = () => {
    if (allOpen) {
      setOpenIndexes(new Set());
    } else {
      setOpenIndexes(new Set(faqs.map((_, i) => i)));
    }
  };

  const toggleItem = (i) => {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="qa-page">
      <Navbar />

      <div className="qa-overlay"></div>
      <div className="qa-scanlines"></div>

      {/* --- Hero Section --- */}
      <section className="qa-hero">
        <div className="hero-decoration">
          <Search size={16} />
          <span>KNOWLEDGE_BASE_v2.1</span>
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
          <span className="qa-count">{faqs.length}</span>
        </div>

        {/* Toolbar: wyszukiwarka + rozwiń/zwiń */}
        <div className="qa-toolbar">
          <div className="qa-search">
            <Search size={14} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('qa.searchPlaceholder', 'SZUKAJ W BAZIE...')}
              aria-label={t('qa.searchPlaceholder', 'SZUKAJ W BAZIE...')}
            />
            {search && (
              <button
                className="qa-search-clear"
                onClick={() => setSearch('')}
                aria-label="Wyczyść wyszukiwanie"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            className={`qa-toggle-all ${allOpen ? 'open' : ''}`}
            onClick={toggleAll}
            disabled={faqs.length === 0}
          >
            <ChevronsUpDown size={14} />
            <span>
              {allOpen
                ? t('qa.collapseAll', 'ZWIŃ WSZYSTKIE')
                : t('qa.expandAll', 'ROZWIŃ WSZYSTKIE')}
            </span>
          </button>
        </div>

        {faqs.length > 0 ? (
          <div className="qa-faq-list">
            {faqs.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                index={index}
                isOpen={openIndexes.has(index)}
                onToggle={() => toggleItem(index)}
              />
            ))}
          </div>
        ) : (
          <motion.div
            className="qa-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search size={24} />
            <p>{t('qa.noResults', 'BRAK WYNIKÓW DLA TEGO ZAPYTANIA')}</p>
          </motion.div>
        )}
      </main>

      <footer className="qa-footer">
        <div className="footer-deco">
          <span></span><span></span><span></span>
        </div>
      </footer>
    </div>
  );
}
