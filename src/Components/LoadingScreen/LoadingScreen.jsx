import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './LoadingScreen.css';
import logo from '../../Assets/logo.png';

const LoadingScreen = () => {
    const { t } = useTranslation();
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingText, setLoadingText] = useState(t('loadingScreen.status1'));

    useEffect(() => {
        const loadingMessages = [
            t('loadingScreen.status1'),
            t('loadingScreen.status2'),
            "ENCRYPTING DATA...",
            t('loadingScreen.status3'),
            "OPTICAL SENSORS... OK",
            t('loadingScreen.status4'),
            t('loadingScreen.status5'),
            t('loadingScreen.statusReady')
        ];

        const interval = setInterval(() => {
            setLoadingProgress(prev => {
                // Faster increment at the end
                const increment = prev > 80 ? 4 : 1.5;
                const newProgress = Math.min(prev + increment, 100);

                if (newProgress >= 100) {
                    clearInterval(interval);
                    setLoadingText(loadingMessages[loadingMessages.length - 1]);
                    return 100;
                }

                // Update text based on progress
                const messageIndex = Math.floor((newProgress / 100) * (loadingMessages.length - 1));
                setLoadingText(loadingMessages[messageIndex]);

                return newProgress;
            });
        }, 30);

        return () => clearInterval(interval);
    }, [t]);

    return (
        <div className="loading-screen">
            <div className="loading-bg"></div>

            <div className="loading-container">
                <div className="logo-wrapper">
                    <img src={logo} alt="Loading..." className="loading-logo-img" />
                </div>

                <h2 className="loading-title-new">
                    Zjednoczona Polska Korona
                </h2>

                <div className="progress-container">
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${loadingProgress}%` }}
                        ></div>
                    </div>
                </div>

                <div className="loading-status-text-new">
                    {loadingText} :: {Math.round(loadingProgress)}%
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;