/**
 * src/Components/WarLogs/WarLogsManagePanel.jsx
 *
 * Panel zarządzania raportami wojennymi (dla adminów).
 * Wydzielony z WarLogs.jsx — wzorzec jak KOSManagePanel:
 * strona trzyma stan i handlery (fetch, cloud/local, refresh),
 * panel jest presentational (propsy = interfejs, test surface).
 *
 * Propsy:
 *   cloudReady, showAdminPanel/setShowAdminPanel, adminTab/setAdminTab,
 *   form/setForm, adminMessage, logs, resultOptions,
 *   handleAddLog, handleRemoveLog
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Shield, Plus, Trash2 } from 'lucide-react';

const WarLogsManagePanel = ({
  cloudReady,
  showAdminPanel,
  setShowAdminPanel,
  adminTab,
  setAdminTab,
  form,
  setForm,
  adminMessage,
  logs,
  resultOptions,
  handleAddLog,
  handleRemoveLog,
}) => {
  const { t } = useTranslation();

  return (
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
                    {resultOptions.filter((r) => r !== "ALL").map((r) => (
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
  );
};

export default WarLogsManagePanel;