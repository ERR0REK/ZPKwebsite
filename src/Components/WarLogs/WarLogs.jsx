import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "../Navbar/Navbar";
import WarLogCard from "./WarLogCard";
import WarLogModal from "./WarLogModal";
import DecodedText from "../Shared/DecodedText";
import { useRealtime } from "../../Realtime/RealtimeProvider";
import { useSession } from "../../Context/SessionContext";
import "./WarLogs.css";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  ShieldQuestion,
  Shield,
  Plus,
  Trash2,
  Cloud,
  CloudOff,
} from "lucide-react";

import warLogsData from "../../data/warLogs.json";

const RESULT_FILTERS = ["ALL", "WIN", "LOSS", "EASY_WIN", "DRAW"];

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem("ZPK_auth_session") || "{}");
  } catch {
    return {};
  }
};

const WarLogs = () => {
  const { t } = useTranslation();
  const realtime = useRealtime();
  const session = useSession();
  const [selectedLog, setSelectedLog] = useState(null);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [cloudReady, setCloudReady] = useState(null); // null = sprawdzam, true/false = wynik
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

  const isAdmin = session.is_admin === true;

  // ═══════════════════════════════════════════════════════════
  // 1. Ładowanie danych — chmura lub fallback lokalny
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    let cancelled = false;
    const loadFromCloud = async () => {
      try {
        const res = await fetch("/api/war-store");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data && data.ok) {
          setLogs(
            Array.isArray(data.logs)
              ? [...data.logs].sort(
                  (a, b) => String(b.date || "").localeCompare(String(a.date || ""))
                )
              : []
          );
          setCloudReady(true);
        } else {
          throw new Error("bad response");
        }
      } catch (err) {
        if (cancelled) return;
        // Fallback — dane z pliku
        const initial = Array.isArray(warLogsData.logs)
          ? warLogsData.logs
          : [];
        setLogs(
          [...initial].sort(
            (a, b) => String(b.date || "").localeCompare(String(a.date || ""))
          )
        );
        setCloudReady(false);
      }
    };
    loadFromCloud();
    return () => {
      cancelled = true;
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 2. Live — subskrypcja zpk-war-status
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!realtime || !realtime.subscribe) return;
    const unsubscribe = realtime.subscribe("zpk-war-status", (msg) => {
      const d = msg.data || {};
      if (d.action === "added" || d.action === "removed") {
        // Odśwież dane z chmury
        fetch("/api/war-store")
          .then((r) => r.json())
          .then((data) => {
            if (data && data.ok && Array.isArray(data.logs)) {
              setLogs(
                [...data.logs].sort(
                  (a, b) =>
                    String(b.date || "").localeCompare(String(a.date || ""))
                )
              );
            }
          })
          .catch(() => {});
        // Toast
        if (typeof realtime.pushToast === "function") {
          realtime.pushToast({
            type: "war",
            title: d.title || t("warLogs.realtime.newWar", "NOWY RAPORT WOJENNY"),
            message:
              d.message ||
              (d.name
                ? t("warLogs.realtime.warWithName", "Wojna z {{name}}", {
                    name: d.name,
                  })
                : ""),
            severity: d.severity || "info",
          });
        }
      }
    });
    return unsubscribe;
  }, [realtime, t]);

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
        const sessionData = readSession();
        const res = await fetch("/api/war-store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: sessionData.access_token,
            log: newLog,
          }),
        });
        const data = await res.json();
        if (res.ok && data && data.ok) {
          setLogs(
            Array.isArray(data.logs)
              ? [...data.logs].sort(
                  (a, b) =>
                    String(b.date || "").localeCompare(String(a.date || ""))
                )
              : []
          );
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
        const sessionData = readSession();
        const res = await fetch("/api/war-store", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: sessionData.access_token,
            id: logId,
          }),
        });
        const data = await res.json();
        if (res.ok && data && data.ok) {
          setLogs(
            Array.isArray(data.logs)
              ? [...data.logs].sort(
                  (a, b) =>
                    String(b.date || "").localeCompare(String(a.date || ""))
                )
              : []
          );
        }
      } catch (err) {
        // ignoruj
      }
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== logId));
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

        {/* ═══ Admin Panel ═══ */}
        {isAdmin && (
          <div className="warlogs-admin-section">
            <button
              className="warlogs-admin-toggle"
              onClick={() => setShowAdminPanel(!showAdminPanel)}
            >
              <Shield size={14} />
              <span>
                {showAdminPanel
                  ? t("kos.manage.close", "ZAMKNIJ")
                  : cloudReady
                  ? "ZARZĄDZAJ CHMURĄ"
                  : "ZARZĄDZAJ LOKALNIE"}
              </span>
            </button>

            {showAdminPanel && (
              <motion.div
                className="warlogs-admin-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {/* Tabs */}
                <div className="warlogs-admin-tabs">
                  <button
                    className={`warlogs-admin-tab ${adminTab === "add" ? "active" : ""}`}
                    onClick={() => setAdminTab("add")}
                  >
                    <Plus size={12} /> DODAJ RAPORT
                  </button>
                  <button
                    className={`warlogs-admin-tab ${adminTab === "list" ? "active" : ""}`}
                    onClick={() => setAdminTab("list")}
                  >
                    <Trash2 size={12} /> LISTA ({logs.length})
                  </button>
                </div>

                {/* Add tab */}
                {adminTab === "add" && (
                  <form className="warlogs-admin-form" onSubmit={handleAddLog}>
                    <div className="warlogs-form-row">
                      <div className="warlogs-form-group">
                        <label>PRZECIWNIK *</label>
                        <input
                          type="text"
                          value={form.opponent}
                          onChange={(e) =>
                            setForm({ ...form, opponent: e.target.value })
                          }
                          placeholder="np. ESF (Elite Strike Forces)"
                          required
                        />
                      </div>
                      <div className="warlogs-form-group">
                        <label>DATA</label>
                        <input
                          type="date"
                          value={form.date}
                          onChange={(e) =>
                            setForm({ ...form, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="warlogs-form-group">
                        <label>WYNIK</label>
                        <select
                          value={form.result}
                          onChange={(e) =>
                            setForm({ ...form, result: e.target.value })
                          }
                        >
                          {RESULT_FILTERS.filter((r) => r !== "ALL").map((r) => (
                            <option key={r} value={r}>
                              {t(`warLogs.results.${r}`, r)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="warlogs-form-row">
                      <div className="warlogs-form-group">
                        <label>CZAS TRWANIA</label>
                        <input
                          type="text"
                          value={form.duration}
                          onChange={(e) =>
                            setForm({ ...form, duration: e.target.value })
                          }
                          placeholder="np. 4 godziny 30 minut"
                        />
                      </div>
                      <div className="warlogs-form-group">
                        <label>POWÓD</label>
                        <input
                          type="text"
                          value={form.reason}
                          onChange={(e) =>
                            setForm({ ...form, reason: e.target.value })
                          }
                          placeholder="np. raid bez powodu"
                        />
                      </div>
                    </div>

                    <div className="warlogs-form-row">
                      <div className="warlogs-form-group flex-2">
                        <label>CZŁONKOWIE (przez przecinek)</label>
                        <input
                          type="text"
                          value={form.members}
                          onChange={(e) =>
                            setForm({ ...form, members: e.target.value })
                          }
                          placeholder="@user1, @user2, @user3"
                        />
                      </div>
                      <div className="warlogs-form-group">
                        <label>MVP</label>
                        <input
                          type="text"
                          value={form.mvp}
                          onChange={(e) =>
                            setForm({ ...form, mvp: e.target.value })
                          }
                          placeholder="@best_player"
                        />
                      </div>
                    </div>

                    <div className="warlogs-form-row">
                      <div className="warlogs-form-group flex-2">
                        <label>URL OBRAZKA (opcjonalnie)</label>
                        <input
                          type="text"
                          value={form.img}
                          onChange={(e) =>
                            setForm({ ...form, img: e.target.value })
                          }
                          placeholder="https://..."
                        />
                      </div>
                      <div className="warlogs-form-group flex-2">
                        <label>LINK DO NAGRANIA (YouTube / Medal.tv / Discord)</label>
                        <input
                          type="text"
                          value={form.videoUrl}
                          onChange={(e) =>
                            setForm({ ...form, videoUrl: e.target.value })
                          }
                          placeholder="https://www.youtube.com/watch?v=..."
                        />
                      </div>
                    </div>

                    <button type="submit" className="warlogs-admin-submit">
                      <Plus size={14} />
                      DODAJ RAPORT
                    </button>

                    {adminMessage && (
                      <div className="warlogs-admin-message">{adminMessage}</div>
                    )}
                  </form>
                )}

                {/* List tab */}
                {adminTab === "list" && (
                  <div className="warlogs-admin-list">
                    {logs.length === 0 ? (
                      <div className="warlogs-admin-empty">Brak raportów</div>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id || log.opponent} className="warlogs-admin-item">
                          <div className="warlogs-admin-item-info">
                            <span className="warlogs-admin-item-name">
                              {log.opponent}
                            </span>
                            <span className="warlogs-admin-item-date">
                              {log.date} • {log.result || "N/A"}
                            </span>
                          </div>
                          <button
                            className="warlogs-admin-remove-btn"
                            onClick={() => handleRemoveLog(log.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </div>
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
