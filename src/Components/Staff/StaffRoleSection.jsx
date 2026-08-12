import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import StaffMemberCard from './StaffMemberCard';

const StaffRoleSection = ({ roleTitle, members, onMemberMoreInfo }) => {
  const { t } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <motion.section
      className="staff-role-section"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <motion.div
        className="role-header"
        initial={{ x: -30, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        viewport={{ once: true }}
      >
        <h2 className="role-title">{roleTitle}</h2>
      </motion.div>
      {members && members.length > 0 ? (
        <motion.div
          className="members-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {members.map((member, index) => (
            <motion.div key={`${member.id || index}`} variants={itemVariants}>
              <StaffMemberCard
                member={member}
                onMoreInfo={onMemberMoreInfo}
              />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.p
          className="staff-no-members"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          viewport={{ once: true }}
        >
          {t('staff.noMembers', 'Brak członków w tej roli')}
        </motion.p>
      )}
    </motion.section>
  );
};

export default StaffRoleSection;
