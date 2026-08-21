/* src/Components/Pages/Staff.jsx */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import Navbar from "../Navbar/Navbar";
import StaffRoleSection from "../Staff/StaffRoleSection";
import StaffMemberModal from "../Staff/StaffMemberModal";
import DecodedText from "../Shared/DecodedText";

/* Importowanie obrazków członków kadry */

import ERR0N1XPFP from "../../Assets/StaffMembersPFP/ERR0N1XPFP.webp"
import PolakexePFP from "../../Assets/StaffMembersPFP/PolakexePFP.png"

/* Koniec importowania obrazków */

import "../Staff/Staff.css";

export default function Staff() {
  const { t } = useTranslation();
  const [selectedMember, setSelectedMember] = useState(null);

  // Dane przykładowe członków kadry
  // Można je zastąpić danymi z API lub bazy danych
  const staffData = {
    factionCommand: [
      {
        id: 1,
        name: "(polonia.errorglitchtv) ☦ 𝕆ℕℝ_𝔼ℝℝ𝟘ℕ𝟙𝕏 ☦",
        role: "Właściciel",
        robloxUsername: "ERR0R_Gl1tchTV",
        robloxUserId: "2537111023",
        avatar: ERR0N1XPFP
      }
    ],
    factionCoLeader: [
      {
        id: 2,
        name: "(polak.exe.) Chuj wie kto",
        role: "Współwłaściciel",
        robloxUsername: "Polskaexe_v3",
        robloxUserId: "8830479938",
        avatar: PolakexePFP 
      }
    ],
    technicalSpecialist: [],
    trialCoLeader: [],
    elder: [],
    trialElder: [],
    headAdministrator: [],
    seniorAdministrator: [],
    administrator: [],
    trialAdministrator: [],
    seniorModerator: [],
    moderator: [],
    trialModerator: [],
  };

  const handleMemberMoreInfo = (member) => {
    setSelectedMember(member);
  };

  const closeModal = () => {
    setSelectedMember(null);
  };

  return (
    <div className="staff-page">
      {/* Background Elements */}
      <div className="staff-bg-container">
        <div className="staff-bg-grid"></div>
        <div className="staff-bg-nodes"></div>
        <div className="staff-bg-overlay"></div>
      </div>

      <Navbar />

      {/* --- Sekcja Hero --- */}
      <motion.section
        className="staff-hero-section"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="staff-hero-title">
          <DecodedText 
            text={t("staff.title", "MEET THE STAFF TEAM!")} 
            delay={0.2} 
          />
        </h1>
        <motion.div
          className="staff-hero-divider"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        ></motion.div>
      </motion.section>

      {/* --- Główny kontener treści --- */}
      <motion.main
        className="staff-main-container"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.15,
            }
          }
        }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.05 }}
      >
        {/* Faction Command */}
        <StaffRoleSection
          roleTitle={t("staff.roles.factionCommand", "Faction Command")}
          members={staffData.factionCommand}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Faction Co Leader */}
        <StaffRoleSection
          roleTitle={t("staff.roles.factionCoLeader", "Faction Co Leader")}
          members={staffData.factionCoLeader}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Technical Specialist */}
        <StaffRoleSection
          roleTitle={t(
            "staff.roles.technicalSpecialist",
            "Technical Specialist"
          )}
          members={staffData.technicalSpecialist}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Trial Co Leader */}
        <StaffRoleSection
          roleTitle={t("staff.roles.trialCoLeader", "Trial Co Leader")}
          members={staffData.trialCoLeader}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Elder */}
        <StaffRoleSection
          roleTitle={t("staff.roles.elder", "Elder")}
          members={staffData.elder}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Trial Elder */}
        <StaffRoleSection
          roleTitle={t("staff.roles.trialElder", "Trial Elder")}
          members={staffData.trialElder}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Head Administrator */}
        <StaffRoleSection
          roleTitle={t("staff.roles.headAdministrator", "Head Administrator")}
          members={staffData.headAdministrator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Senior Administrator */}
        <StaffRoleSection
          roleTitle={t(
            "staff.roles.seniorAdministrator",
            "Senior Administrator"
          )}
          members={staffData.seniorAdministrator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Administrator */}
        <StaffRoleSection
          roleTitle={t(
            "staff.roles.administrator"
          )}
          members={staffData.administrator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Trial Administrator */}
        <StaffRoleSection
          roleTitle={t("staff.roles.trialAdministrator")}
          members={staffData.trialAdministrator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Senior Moderator */}
        <StaffRoleSection
          roleTitle={t("staff.roles.seniorModerator")}
          members={staffData.seniorModerator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Moderator */}
        <StaffRoleSection
          roleTitle={t("staff.roles.moderator")}
          members={staffData.moderator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />

        {/* Trial Moderator */}
        <StaffRoleSection
          roleTitle={t("staff.roles.trialModerator")}
          members={staffData.trialModerator}
          onMemberMoreInfo={handleMemberMoreInfo}
        />
      </motion.main>

      {/* --- Modal Staff Member --- */}
      <StaffMemberModal member={selectedMember} onClose={closeModal} />
    </div>
  );
}
