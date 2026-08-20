/* src/Components/Shared/PrivacyToast.jsx
 * Jednorazowy toast prywatności — pokazuje się przy pierwszej wizycie
 * i znika po 6 sekundach. Zapamiętywany w localStorage (raz na sesję).
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'zpk_privacy_seen';

const PrivacyToast = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            if (!sessionStorage.getItem(STORAGE_KEY)) {
                setVisible(true);
                sessionStorage.setItem(STORAGE_KEY, '1');
                const timer = setTimeout(() => setVisible(false), 6000);
                return () => clearTimeout(timer);
            }
        } catch (e) {
            /* ignore */
        }
    }, []);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    className="privacy-toast"
                    initial={{ opacity: 0, y: 60, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 60, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                >
                    <div className="privacy-toast-icon">
                        <ShieldCheck size={18} />
                    </div>
                    <div className="privacy-toast-body">
                        <span className="privacy-toast-tag">PRIVACY_PROTOCOL</span>
                        <span className="privacy-toast-text">
                            Twoje dane są bezpieczne. Strona nie zbiera IP ani danych osobowych.
                        </span>
                    </div>
                    <button
                        className="privacy-toast-close"
                        onClick={() => setVisible(false)}
                        aria-label="Zamknij"
                    >
                        <X size={14} />
                    </button>
                    <div className="privacy-toast-progress" />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default PrivacyToast;
