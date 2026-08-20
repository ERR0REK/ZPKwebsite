/* src/Components/Shared/PrivacyBanner.jsx
 * Banner prywatności w stopce — informuje użytkowników, że strona
 * nie zbiera danych. Wyświetla się na dole strony głównej.
 */

import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PrivacyBanner = () => {
    const { t } = useTranslation();

    return (
        <div className="privacy-banner">
            <div className="privacy-banner-inner">
                <div className="privacy-banner-icon">
                    <ShieldCheck size={16} />
                </div>
                <div className="privacy-banner-text">
                    <span className="privacy-banner-title">
                        <Lock size={10} />
                        {t('privacyBanner.title', 'PRIVACY_MODE: ACTIVE')}
                    </span>
                    <span className="privacy-banner-desc">
                        {t('privacyBanner.desc', 'Twoje dane są bezpieczne. Strona nie zbiera IP, cookies ani żadnych danych osobowych. Hosting: Netlify (USA/EU). SSL/TLS encryption active.')}
                    </span>
                </div>
                <a
                    href="#/privacy"
                    className="privacy-banner-link"
                >
                    {t('privacyBanner.policy', 'Polityka Prywatności →')}
                </a>
            </div>
        </div>
    );
};

export default PrivacyBanner;
