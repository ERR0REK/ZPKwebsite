/**
 * src/Components/KOS/KOSManagePanel.jsx
 *
 * Panel zarządzania celami KOS (dla adminów).
 * Wydzielony z KOS.jsx (~250 linii JSX) jako deep module
 * z własnym interfacsem (propsy) i test surface.
 *
 * Odpowiada za:
 * - Formularz dodawania celów (osoby / klany)
 * - Tab personal/faction
 * - Upload zdjęć dowodów
 * - Listę zapisanych celów z przyciskiem usuwania
 * - Wskaźnik trybu (cloud / local)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
    Database,
    ShieldAlert,
    Wifi,
    Plus,
    Trash2,
    Upload,
    Loader2,
} from 'lucide-react';

const REASON_KEYS = [
    'reasonExploit',
    'reasonSpy',
    'reasonScam',
    'reasonRaid',
    'reasonGrief',
    'reasonImpersonation',
    'reasonHate',
];

const KOSManagePanel = ({
    cloudReady,
    isAdmin,
    manageTab,
    setManageTab,
    form,
    setForm,
    personalTargets,
    factionTargets,
    handleAddTarget,
    handleRemoveTarget,
    handleResetLocal,
    handleUpload,
    uploading,
    uploadError,
    adminMessage,
    getReasonText,
    onClose,
}) => {
    const { t } = useTranslation();

    const targets = manageTab === 'personal' ? personalTargets : factionTargets;

    return (
        <motion.div
            className="manage-modal"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="intel-header">
                <Database className="intel-icon" size={32} />
                <div>
                    <h2 className="intel-title">
                        {cloudReady === true ? t('kos.manage.titleCloud') : t('kos.manage.title')}
                    </h2>
                    <p className="intel-subtitle">
                        {cloudReady === true ? t('kos.manage.subtitleCloud') : t('kos.manage.subtitle')}
                    </p>
                </div>
            </div>

            {/* Wskaźnik trybu zapisu */}
            {cloudReady !== null && (
                <div className={`cloud-status ${cloudReady ? 'cloud-online' : 'cloud-offline'}`}>
                    <Wifi size={14} />
                    <span>
                        {cloudReady ? t('kos.manage.cloudOnline') : t('kos.manage.cloudOffline')}
                    </span>
                </div>
            )}

            {/* Komunikat po dodaniu/usunięciu celu (sukces chmura/lokalnie) */}
            {adminMessage && <div className="kos-admin-message">{adminMessage}</div>}

            {!isAdmin && (
                <div className="manage-admin-warning">
                    <ShieldAlert size={16} />
                    <span>{t('kos.manage.adminOnlyWarning')}</span>
                </div>
            )}

            <div className="manage-tabs">
                {['personal', 'faction'].map((tab) => (
                    <button
                        key={tab}
                        className={`manage-tab ${manageTab === tab ? 'active' : ''}`}
                        onClick={() => setManageTab(tab)}
                    >
                        {t(`kos.filters.${tab}`)}
                    </button>
                ))}
            </div>

            <form className="manage-form" onSubmit={handleAddTarget}>
                <div className="manage-field">
                    <label>{t('kos.manage.nameLabel')}</label>
                    <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder={t('kos.manage.namePlaceholder')}
                        required
                    />
                </div>

                <div className="manage-field">
                    <label>{t('kos.manage.reasonLabel')}</label>
                    <div className="reason-mode-tabs">
                        <button
                            type="button"
                            className={`reason-mode-tab ${form.reasonMode === 'preset' ? 'active' : ''}`}
                            onClick={() => setForm((f) => ({ ...f, reasonMode: 'preset' }))}
                        >
                            {t('kos.manage.reasonPreset')}
                        </button>
                        <button
                            type="button"
                            className={`reason-mode-tab ${form.reasonMode === 'custom' ? 'active' : ''}`}
                            onClick={() => setForm((f) => ({ ...f, reasonMode: 'custom' }))}
                        >
                            {t('kos.manage.reasonCustom')}
                        </button>
                    </div>
                    {form.reasonMode === 'preset' ? (
                        <select
                            value={form.reasonKey}
                            onChange={(e) => setForm((f) => ({ ...f, reasonKey: e.target.value }))}
                        >
                            {REASON_KEYS.map((key) => (
                                <option key={key} value={key}>
                                    {t(`kos.reasons.${key}`)}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            value={form.customReason}
                            onChange={(e) => setForm((f) => ({ ...f, customReason: e.target.value }))}
                            placeholder={t('kos.manage.customReasonPlaceholder')}
                        />
                    )}
                </div>

                {manageTab === 'personal' ? (
                    <div className="manage-field">
                        <label>{t('kos.manage.robloxLinkLabel')}</label>
                        <input
                            type="url"
                            value={form.robloxLink}
                            onChange={(e) => setForm((f) => ({ ...f, robloxLink: e.target.value }))}
                            placeholder="https://www.roblox.com/users/123456/profile"
                        />
                    </div>
                ) : (
                    <div className="manage-field-row">
                        <div className="manage-field">
                            <label>{t('kos.intel.factionLeaders')}</label>
                            <input
                                type="text"
                                value={form.leaders}
                                onChange={(e) => setForm((f) => ({ ...f, leaders: e.target.value }))}
                                placeholder="Lider1, Lider2"
                            />
                        </div>
                        <div className="manage-field">
                            <label>{t('kos.intel.allies')}</label>
                            <input
                                type="text"
                                value={form.allies}
                                onChange={(e) => setForm((f) => ({ ...f, allies: e.target.value }))}
                                placeholder="Klan Sojuszniczy"
                            />
                        </div>
                        <div className="manage-field">
                            <label>{t('kos.intel.firepower')}</label>
                            <input
                                type="text"
                                value={form.firepower}
                                onChange={(e) => setForm((f) => ({ ...f, firepower: e.target.value }))}
                                placeholder="HEAVY_ARMORED"
                            />
                        </div>
                    </div>
                )}

                <div className="manage-field">
                    <label>{t('kos.manage.evidenceLabel')}</label>
                    <textarea
                        rows={4}
                        value={form.evidenceText}
                        onChange={(e) => setForm((f) => ({ ...f, evidenceText: e.target.value }))}
                        placeholder={t('kos.manage.evidenceHint')}
                    />
                </div>

                {isAdmin && (
                    <div className="upload-box">
                        <label className="upload-btn">
                            {uploading ? (
                                <Loader2 size={14} className="spin" />
                            ) : (
                                <Upload size={14} />
                            )}
                            <span>
                                {uploading ? t('kos.manage.uploading') : t('kos.manage.uploadBtn')}
                            </span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUpload}
                                disabled={uploading}
                            />
                        </label>
                        {uploadError && (
                            <span className="upload-error">{t('kos.manage.uploadError')}</span>
                        )}
                    </div>
                )}

                <button
                    type="submit"
                    className="manage-add-btn"
                    disabled={form.reasonMode === 'custom' && !form.customReason.trim()}
                >
                    <Plus size={14} />
                    <span>{t('kos.manage.addBtn')}</span>
                </button>
            </form>

            <div className="manage-list">
                <h4 className="manage-list-title">{t('kos.manage.listTitle')}</h4>
                {targets.length === 0 ? (
                    <p className="manage-empty">{t('kos.manage.empty')}</p>
                ) : (
                    targets.map((target) => (
                        <div key={target.name} className="manage-item">
                            <span className="manage-item-name">{target.name}</span>
                            <span className="manage-item-reason">{getReasonText(target)}</span>
                            <button
                                type="button"
                                className="manage-remove-btn"
                                onClick={() => handleRemoveTarget(target.name)}
                                title={t('kos.manage.remove')}
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>

            {cloudReady !== true && (
                <button type="button" className="manage-reset-btn" onClick={handleResetLocal}>
                    {t('kos.manage.resetBtn')}
                </button>
            )}

            <button className="close-intel-btn" onClick={onClose}>
                {t('kos.intel.close')}
            </button>

            <div className="intel-hud-corners">
                <div className="h-tl"></div><div className="h-tr"></div>
                <div className="h-bl"></div><div className="h-br"></div>
            </div>
        </motion.div>
    );
};

export default KOSManagePanel;
