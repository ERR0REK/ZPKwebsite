import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../Navbar/Navbar";
import WarLogCard from "./WarLogCard";
import WarLogModal from "./WarLogModal";
import DecodedText from "../Shared/DecodedText";
import WarLogsManagePanel from "./WarLogsManagePanel";
import useCloudStore from "../../hooks/useCloudStore";
import { useSession } from "../../Context/SessionContext";
import "./WarLogs.css";
import { AnimatePresence, motion } from "framer-motion";
import { Search, ShieldQuestion, Cloud, CloudOff } from "lucide-react";

import warLogsData from "../../data/warLogs.json";

const RESULT_FILTERS = ["ALL", "WIN", "LOSS", "EASY_WIN", "DRAW"];

// Stabilne referencje dla useCloudStore (poziom modułu) — inline-funkcja
// normalizeFn tworzyła nową referencję przy każdym renderze, co odpalało
// ponowny GET /api/war-store przy każdej zmianie stanu strony.
const WAR_SEED_LOGS = Array.isArray(warLogsData.logs) ? warLogsData.logs : [];
const WAR_NORMALIZE_FN = (res) => (Array.isArray(res.logs) ? res.logs : []);



const WarLogs = () => {
  const { t } = useTranslation();
  const { session } = useSession();
  const [selectedLog, setSelectedLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState("add"); // add | list
  const [form, setForm] = useState({
    opponent: "",
    date: new Date().toISOString().slice(0, 10),
    result: "WIN",
    reason: "",
    duration: "",
    members: "",
    mvp: "",
    img: "",
    videoUrl: "",
  });
  const [adminMessage, setAdminMessage] = useState("");

  const isAdmin = session?.is_admin === true;

  // ☁️ useCloudStore — fetch z chmury, fallback na seed, realtime (Ably)
  const { data: cloudLogs, cloudReady, refresh: refreshCloud } = useCloudStore({
    endpoint: "/api/war-store",
    channel: "zpk-war-status",
    seedData: WAR_SEED_LOGS,
    normalizeFn: WAR_NORMALIZE_FN,
  });

  // Sync cloudLogs → local logs state (posortowane)
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    if (cloudLogs) {
      setLogs(
        [...cloudLogs].sort(
          (a, b) => String(b.date || "").localeCompare(String(a.date || ""))
        )
      );
    }
  }, [cloudLogs]);

  // ═══════════════════════════════════════════════════════════
  // 3. Filtrowanie i sortowanie
  // ═══════════════════════════════════════════════════════════
  const sortedLogs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...logs]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .filter((log) => {
        if (
          resultFilter !== "ALL" &&
          (log.result || "").toUpperCase() !== resultFilter
        ) {
          return false;
        }
        if (!q) return true;
        const haystack = [
          log.opponent,
          log.reason,
          log.duration,
          log.mvp,
          log.members,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [logs, searchTerm, resultFilter]);

  // ═══════════════════════════════════════════════════════════
  // 4. Admin — dodawanie raportu
  // ═══════════════════════════════════════════════════════════
  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!form.opponent.trim()) return;
    setAdminMessage("");

    const newLog = {
      opponent: form.opponent.trim(),
      date: form.date,
      result: form.result,
      reason: form.reason.trim(),
      duration: form.duration.trim(),
      members: form.members.trim(),
      mvp: form.mvp.trim(),
      img: form.img.trim() || "https://via.placeholder.com/1200x600?text=ZPK+War+Report",
      videoUrl: form.videoUrl.trim(),
      enemyKD: [],
      memberKD: [],
    };

    if (cloudReady) {
      try {
        const res = await fetch("/api/war-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session?.access_token,
            log: newLog,
          }),
        });
        const data = await res.json();
        if (res.ok && data && data.ok) {
          refreshCloud();
          setAdminMessage("✅ Raport dodany do chmury");
          setForm({
            opponent: "",
            date: new Date().toISOString().slice(0, 10),
            result: "WIN",
            reason: "",
            duration: "",
            members: "",
            mvp: "",
            img: "",
            videoUrl: "",
          });
        } else {
          setAdminMessage(`❌ ${data.error || "Błąd zapisu"}`);
        }
      } catch (err) {
        setAdminMessage("❌ Błąd sieci");
      }
    } else {
      // Tryb lokalny
      newLog.id = Date.now();
      setLogs((prev) => [newLog, ...prev]);
      setAdminMessage("✅ Raport dodany (lokalnie)");
      setForm({
        opponent: "",
        date: new Date().toISOString().slice(0, 10),
        result: "WIN",
        reason: "",
        duration: "",
        members: "",
        mvp: "",
        img: "",
        videoUrl: "",
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // 5. Admin — usuwanie raportu
  // ═══════════════════════════════════════════════════════════
  const handleRemoveLog = async (logId) => {
    if (!window.confirm("Usunąć ten raport wojenny?")) return;

    if (cloudReady) {
      try {
        const res = await fetch("/api/war-store", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: session?.access_token,
            id: logId,
          }),
        });
        const data = await res.json();
        if (res.ok && data && data.ok) {
          refreshCloud();
          setAdminMessage("✅ Raport usunięty z chmury");
        } else {
          setAdminMessage(`❌ ${data?.error || "Błąd usuwania"}`);
        }
      } catch (err) {
        setAdminMessage("❌ Błąd sieci");
      }
    } else {
      setLogs((prev) => prev.filter((l) => String(l.id) !== String(logId)));
      setAdminMessage("✅ Raport usunięty (lokalnie)");
    }
  };

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
            transition: { staggerChildren: 0.1 },
          },
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
            <DecodedText
              text={t("warLogs.title", "WAR LOGS")}
              delay={0.2}
            />
          </h1>
          <div className="header-decoration">
            <span className="deco-line"></span>
            <span className="deco-tech">:: ARCHIVE ACCESS ::</span>
            <span className="deco-line"></span>
          </div>
          {/* Cloud status + Live indicator */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "12px" }}>
            {cloudReady === true && (
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "0.65rem",
                letterSpacing: "1px",
                color: "#4ade80",
                border: "1px solid rgba(74,222,128,0.3)",
                padding: "3px 10px",
              }}>
                <Cloud size={10} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                CLOUD SYNC: ACTIVE
              </span>
            )}
            {cloudReady === false && (
              <span style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: "0.65rem",
                letterSpacing: "1px",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.3)",
                padding: "3px 10px",
              }}>
                <CloudOff size={10} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                LOCAL MODE
              </span>
            )}
          </div>
        </header>

        {/* ═══ Admin Panel (wydzielony moduł) ═══ */}
        {isAdmin && (
          <WarLogsManagePanel
            cloudReady={cloudReady}
            showAdminPanel={showAdminPanel}
            setShowAdminPanel={setShowAdminPanel}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            form={form}
            setForm={setForm}
            adminMessage={adminMessage}
            logs={logs}
            resultOptions={RESULT_FILTERS}
            handleAddLog={handleAddLog}
            handleRemoveLog={handleRemoveLog}
          />
        )}

        {/* Toolbar */}
        <div className="warlogs-toolbar">
          <div className="warlogs-search">
            <Search size={15} className="warlogs-search-icon" />
            <input
              type="text"
              placeholder={t(
                "warLogs.searchPlaceholder",
                "SZUKAJ... (przeciwnik, powód, członkowie)"
              )}
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
                {r === "ALL"
                  ? t("warLogs.tabs.all", "WSZYSTKIE")
                  : t(`warLogs.results.${r}`, r)}
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
              <div className="empty-icon">
                <ShieldQuestion size={34} />
              </div>
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
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedLog && (
          <WarLogModal
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default WarLogs;
