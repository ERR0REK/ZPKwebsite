import React from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import './WarLogs.css';

const WarLogCard = ({ log, onClick, delay }) => {
    const { t } = useTranslation();

    const resultClass =
        log.result === 'WIN' || log.result === 'EASY_WIN' ? 'result-win' :
            log.result === 'LOSS' ? 'result-loss' : 'result-draw';

    const resultLabel = t(`warLogs.results.${log.result}`);

    return (
        <motion.div
            className="warlog-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delay, duration: 0.5 }}
            onClick={onClick}
            whileHover={{ scale: 1.02, translateY: -5 }}
        >
            <div className="card-image-container">
                <img src={log.victoryImg || log.img} alt={`War against ${log.opponent}`} className="card-bg-img" />
                <div className={`card-result-badge ${resultClass}`}>
                    {resultLabel}
                </div>
                <div className="card-overlay"></div>
            </div>

            <div className="card-content">
                <div className="card-header">
                    <span className="card-date">{log.date}</span>
                    {log.map && <span className="card-map">{log.map}</span>}
                </div>

                <h3 className="card-title">
                    {t('warLogs.labels.warWith', { opponent: log.opponent })}
                </h3>

                <div className="card-data-preview">
                    <div className="preview-row">
                        <span className="preview-label">{t('warLogs.labels.result')}:</span>
                        <span className={`preview-value ${resultClass}`}>{resultLabel}</span>
                    </div>
                </div>

                <div className="card-footer">
                    <button className="details-btn">
                        {t('warLogs.readMore', 'ACCESS DATA')} &gt;
                    </button>
                </div>
            </div>

            <div className="card-corners">
                <span className="corner tl"></span>
                <span className="corner tr"></span>
                <span className="corner bl"></span>
                <span className="corner br"></span>
            </div>
        </motion.div>
    );
};

export default WarLogCard;
