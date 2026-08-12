import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const LanguageSelector = ({ onSelect, forceShow = false }) => {
    const { i18n } = useTranslation();
    const [showModal, setShowModal] = useState(forceShow);

    const languages = [
        { code: 'en', name: 'English', label: 'EN' },
        { code: 'pl', name: 'Polish', label: 'PL' },
    ];

    useEffect(() => {
        if (forceShow) {
            setShowModal(true);
        }
    }, [forceShow]);

    const handleLanguageSelect = (lang) => {
        localStorage.setItem('selectedLanguage', lang);
        i18n.changeLanguage(lang);
        setShowModal(false);
        if (onSelect) onSelect(lang);
    };

    const handleMissingLanguage = (e) => {
        e.preventDefault();
        localStorage.setItem('selectedLanguage', 'en');
        i18n.changeLanguage('en');
        setShowModal(false);
        if (onSelect) onSelect('en');
        window.open('https://discord.gg/ZPK', '_blank', 'noopener,noreferrer');
    };

    const currentLang = i18n.language;

    return (
        <>
            {showModal && (
                <div className="language-modal-overlay">
                    <div className="language-modal">
                        <div className="lang-hud-tl"></div><div className="lang-hud-tr"></div>
                        <div className="lang-hud-bl"></div><div className="lang-hud-br"></div>

                        <div className="language-header-group">
                            <h2 className="language-modal-title">SELECT INTERFACE LANGUAGE</h2>
                            <p className="language-modal-desc">Unauthorized access restricted. Choose a secure translation uplink to proceed.</p>
                        </div>

                        <div className="language-list-container">
                            <div className="language-list">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        className={`lang-btn ${currentLang === lang.code ? 'lang-btn-active' : ''}`}
                                        onClick={() => handleLanguageSelect(lang.code)}
                                    >
                                        <div className="lang-code-box">[ {lang.label} ]</div>
                                        <div className="lang-name">{lang.name}</div>
                                        {currentLang === lang.code && (
                                            <span className="lang-active-badge">UPLINK SECURED</span>
                                        )}
                                        <div className="scan-line-btn"></div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="language-footer">
                            <p className="language-hint">💡 Scroll to view more options</p>
                            <div className="translation-prompt">
                                <p className="translation-text">
                                    Language not listed? You can translate it from English to your native language.
                                </p>
                                <button onClick={handleMissingLanguage} className="translation-link">
                                    [ CLICK HERE TO HELP TRANSLATE ]
                                </button>
                                <p className="translation-warning">
                                    * This will temporarily set your interface to English.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LanguageSelector;
