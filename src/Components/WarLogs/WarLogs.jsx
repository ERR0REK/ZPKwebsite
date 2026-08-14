import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../Navbar/Navbar";
import WarLogCard from "./WarLogCard";
import WarLogModal from "./WarLogModal";
import DecodedText from "../Shared/DecodedText";
import { useRealtime } from "../../Realtime/RealtimeProvider";
import "./WarLogs.css";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ShieldQuestion } from "lucide-react";

import warLogsData from "../../data/warLogs.json";

const RESULT_FILTERS = ["ALL", "WIN", "LOSS", "EASY_WIN", "DRAW"];

const WarLogs = () => {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const [selectedLog, setSelectedLog] = useState(null);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");

  // Źródło prawdy: warLogs.json (edytowane w repo).
  // Sortujemy od najnowszych — jeśli ktoś doda nową wojnę na początku pliku,
  // pojawi się ona pierwsza.
  useEffect(() => {
    const initial = Array.isArray(warLogsData.logs) ? warLogsData.logs : [];
    setLogs([...initial].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))));
  }, []);

  // Live War Logs — gdy ktoś opublikuje nową wojnę na kanale zpk-war-status,
  // odświeżamy listę (fallback: dane z pliku) i pokazujemy toast.
  useEffect(() => {
    if (!realtime || !realtime.subscribe) return;
    const unsubscribe = realtime.subscribe("zpk-war-status", (msg) => {
      const d = msg.data || {};
      if (d.action === "added") {
        if (typeof realtime.pushToast === "function") {
          realtime.pushToast({
            type: "war",
            title: d.title || t("warLogs.realtime.newWar", "NOWY RAPORT WOJENNY"),
            message: d.message || (d.name ? t("warLogs.realtime.warWithName", "Wojna z {{name}}", { name: d.name }) : ""),
            severity: d.severity || "info"
          });
        }
        // Odśwież dane z pliku — realtime jest sygnałem, że coś się zmieniło
        const updated = Array.isArray(warLogsData.logs) ? warLogsData.logs : [];
        setLogs([...updated].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))));
      }
    });
    return unsubscribe;
  }, [realtime, t]);

  const sortedLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...logs]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .filter((log) => {
        // Filtr wyniku
        if (resultFilter !== "ALL" && (log.result || "").toUpperCase() !== resultFilter) {
          return false;
        }
        // Wyszukiwarka (przeciwnik, powód, członkowie, MVP)
        if (!q) return true;
        const haystack = [
          log.opponent,
          log.reason,
          log.duration,
          log.mvp,
          log.members
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [logs, searchTerm, resultFilter]);

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

        {/* Wyszukiwarka + filtr wyniku */}
        <div className="warlogs-toolbar">
          <div className="warlogs-search">
            <Search size={15} className="warlogs-search-icon" />
            <input
              type="text"
              placeholder={t("warLogs.searchPlaceholder", "SZUKAJ... (przeciwnik, powód, członkowie)")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="warlogs-result-filters">
            {RESULT_FILTERS.map((r) => (
              <button
                key={r}
                className={`warlogs-filter-btn ${resultFilter === r ? "active" : ""}`}
                onClick={() => setResultFilter(r)}
              >
                {r === "ALL" ? t("warLogs.tabs.all", "WSZYSTKIE") : t(`warLogs.results.${r}`, r)}
              </button>
            ))}
          </div>
        </div>

        {sortedLogs.length > 0 ? (
          <div className="warlogs-grid">
            {sortedLogs.map((log, index) => (
              <WarLogCard
                key={log.id || index}
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
              <div className="empty-icon"><ShieldQuestion size={34} /></div>
            </div>
            <h2 className="empty-title">
              {logs.length > 0
                ? t("warLogs.noResults", "BRAK WYNIKÓW")
                : t("common.comingSoon", "COMING SOON")}
            </h2>
            <p className="empty-subtitle">
              {logs.length > 0
                ? ":: NO REPORTS MATCH THE FILTERS ::"
                : ":: NO ACTIVE CONFLICTS DETECTED ::"}
            </p>
            <p className="empty-desc">
              {logs.length > 0
                ? "Change the search query or result filter to see more mission reports."
                : "The database is currently synchronizing with command headquarters. Please check back later for mission reports."}
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
