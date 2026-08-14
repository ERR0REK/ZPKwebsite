// src/Components/Shared/BackToTop.jsx
// Pływający przycisk "WRÓĆ NA GÓRĘ" — pojawia się po przewinięciu
// strony w dół (300px), płynnie wraca na górę po kliknięciu.

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import './BackToTop.css';

const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      className="back-to-top-btn"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="BACK_TO_TOP"
    >
      <ArrowUp size={18} />
    </button>
  );
};

export default BackToTop;
