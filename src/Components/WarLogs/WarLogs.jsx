import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../Navbar/Navbar";
import WarLogCard from "./WarLogCard";
import WarLogModal from "./WarLogModal";
import DecodedText from "../Shared/DecodedText";
import "./WarLogs.css";
import { AnimatePresence, motion } from "framer-motion";

const WarLogs = () => {
  const { t } = useTranslation();
  const [selectedLog, setSelectedLog] = useState(null);

  // Real Data with Translation Keys
  const logs = [
    //{
      //id: 1,
      //opponent: t("warLogs.war1.opponent"),
      //date: "2026-01-18",
      //result: "EASY_WIN",
      //duration: t("warLogs.war1.duration"),
      //mvp: "@Hejhej01928, @Polskaexe_v3",
      //reason: t("warLogs.war1.reason"),
      //members: t("warLogs.war1.members"),
      //victoryImg: "https://via.placeholder.com/1200x600?text=Victory+Celebration+Nightfall",
      //enemyKD: [
        //{ name: "@Rushwinter", kills: 1, deaths: 10 },
        //{ name: "@imsocool_leon", kills: 2, deaths: 3 },
        //{ name: "@lucularo", kills: 0, deaths: 4 },
        //{ name: "@umgqqqqqqqaa", kills: 14, deaths: 16 },
        //{ name: "@Birkpro12", kills: 3, deaths: 20 },
       // { name: "@renopro203", kills: 7, deaths: 5 },
      //],
      //memberKD: [
       // { name: "@Hejhej01928", kills: 54, deaths: 20 },
        //{ name: "@Polskaexe_v3", kills: 11, deaths: 5 },
        //{ name: "@Pioter_M200", kills: 0, deaths: 1 },
        //{ name: "@Tygosaures10", kills: 6, deaths: 0 },
        //{ name: "@SAMISALAMI7", kills: 17, deaths: 10 },
      //]
    //}
  ];

  return (
    <div className="warlogs-page">
      <Navbar />
      <div className="warlogs-bg"></div>

      <motion.div 
        className="warlogs-container"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
          }
        }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.05 }}
      >
        <header className="warlogs-header">
          <h1
            className="glitch-text"
            data-text={t("warLogs.title", "WAR LOGS")}
          >
            <DecodedText text={t("warLogs.title", "WAR LOGS")} delay={0.2} />
          </h1>
          <div className="header-decoration">
            <span className="deco-line"></span>
            <span className="deco-tech">:: ARCHIVE ACCESS ::</span>
            <span className="deco-line"></span>
          </div>
        </header>

        {logs.length > 0 ? (
          <div className="warlogs-grid">
            {logs.map((log, index) => (
              <WarLogCard
                key={log.id}
                log={log}
                onClick={() => setSelectedLog(log)}
                delay={index * 0.1}
              />
            ))}
          </div>
        ) : (
          <motion.div
            className="warlogs-empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="empty-icon-container">
              <div className="radar-sweep"></div>
              <div className="empty-icon">❄️</div>
            </div>
            <h2 className="empty-title">
              {t("common.comingSoon", "COMING SOON")}
            </h2>
            <p className="empty-subtitle">:: NO ACTIVE CONFLICTS DETECTED ::</p>
            <p className="empty-desc">
              The database is currently synchronizing with command headquarters.
              <br />
              Please check back later for mission reports.
            </p>
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedLog && (
          <WarLogModal log={selectedLog} onClose={() => setSelectedLog(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WarLogs;
