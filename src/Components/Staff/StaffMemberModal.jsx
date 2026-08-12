import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ExternalLink,
  User,
  Activity,
  Database,
} from 'lucide-react';

const StaffMemberModal = ({ member, onClose }) => {
  const { t } = useTranslation();

  if (!member) return null;

  const handleClose = () => {
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList && e.target.classList.contains('staff-modal-overlay')) {
      handleClose();
    }
  };

  return (
    <AnimatePresence>
      {member && (
        <motion.div
          className="staff-modal-overlay"
          onClick={handleBackdropClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="staff-modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="m-tl"></div><div className="m-tr"></div>
            <div className="m-bl"></div><div className="m-br"></div>
            <div className="modal-scanner-line"></div>

            <button className="staff-modal-close" onClick={handleClose}>
              <X size={20} />
            </button>

            <div className="staff-modal-header">
              <div style={{ position: 'relative' }}>
                <div className="staff-img-scanner"></div>
                <img
                  src={member.avatar || 'https://via.placeholder.com/150'}
                  alt={member.name}
                  className="staff-modal-avatar"
                />
              </div>
              <div className="staff-modal-info">
                <div className="dossier-tag">SUBJECT_DOSSIER_v4.2</div>
                <h2 className="staff-modal-name">{member.name}</h2>
                <p className="staff-modal-role">{member.role}</p>
              </div>
            </div>

            <div className="staff-modal-body">
              <div className="staff-modal-details">
                <div className="staff-modal-detail-item">
                  <span className="staff-modal-label">
                    <User size={16} /> {t('staffModal.robloxUsername', 'ROBLOX_UID')}
                  </span>
                  <span className="staff-modal-value">
                    {member.robloxUsername && member.robloxUserId ? (
                      <a
                        href={`https://www.roblox.com/users/${member.robloxUserId}/profile`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="staff-modal-link"
                      >
                        {member.robloxUsername} <ExternalLink size={12} style={{ marginLeft: 5 }} />
                      </a>
                    ) : (
                      member.robloxUsername || t('common.na', 'N/D')
                    )}
                  </span>
                </div>



                <div className="staff-modal-detail-item">
                  <span className="staff-modal-label">
                    <Activity size={16} /> {t('staffModal.role', 'ASSIGNMENT')}
                  </span>
                  <span className="staff-modal-value">{member.role}</span>
                </div>

                <div className="staff-modal-detail-item">
                  <span className="staff-modal-label">
                    <Database size={16} /> {t('staffModal.status', 'CLEARANCE')}
                  </span>
                  <span className="staff-modal-value" style={{ color: '#00ff66' }}>VERIFIED_STAFF</span>
                </div>
              </div>
            </div>

            <div className="staff-modal-footer">
              <button className="staff-modal-button-close" onClick={handleClose}>
                {t('common.close', 'ZAMKNIJ')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StaffMemberModal;
