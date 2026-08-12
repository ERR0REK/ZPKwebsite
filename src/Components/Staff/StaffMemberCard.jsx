import React from "react";
import { motion } from "framer-motion";

export default function StaffMemberCard({ member, onMoreInfo }) {
  if (!member) return null;

  return (
    <motion.div
      className="staff-card"
      onClick={() => onMoreInfo(member)}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
    >        <div className="card-top">
        <div className="avatar-container">
          <div className="avatar-frame"></div>
          <img
            src={member.avatar || member.image || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541"}
            alt={member.name}
            className="staff-pfp"
            loading="lazy"
          />
        </div>
        <div className="info-container">
          <h3 className="member-name" title={member.name}>{member.name}</h3>
          <p className="member-role">{member.role || member.rank}</p>
        </div>
      </div>

      <div className="card-meta">
        <div className="meta-item">
          <span className="meta-label">ID_SCAN:</span>
          <span className="meta-val mono-text">#{member.id?.toString().padStart(4, '0') || '0000'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">STATUS:</span>
          <span className="meta-val mono-text" style={{ color: 'var(--st-accent)' }}>ACTIVE</span>
        </div>
      </div>

      <div className="scan-line"></div>
      <div className="c-tl"></div><div className="c-tr"></div>
      <div className="c-bl"></div><div className="c-br"></div>
    </motion.div>
  );
}
