/* src/Components/Toasts/ToastContainer.jsx
 * Toasty real-time — powiadomienia na żywo (ogłoszenia, aktywność, KOS, wojny).
 * Styl: taktyczny HUD spójny z resztą strony (scanline, narożniki, neon).
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Megaphone,
    Activity,
    Skull,
    Sword,
    Info,
    X,
    AlertTriangle,
    Radio
} from 'lucide-react';
import './Toasts.css';

const TOAST_META = {
    announcement: { icon: Megaphone, className: 'toast-announcement' },
    activity: { icon: Activity, className: 'toast-activity' },
    kos: { icon: Skull, className: 'toast-kos' },
    war: { icon: Sword, className: 'toast-war' },
    info: { icon: Info, className: 'toast-info' }
};

const ToastItem = ({ toast, onDismiss }) => {
    const meta = TOAST_META[toast.type] || TOAST_META.info;
    const Icon = meta.icon;

    return (
        <motion.div
            className={`toast ${meta.className}`}
            initial={{ opacity: 0, x: 90, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 90, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onClick={() => onDismiss(toast.id)}
            role="status"
        >
            <div className="toast-corner tl"></div>
            <div className="toast-corner tr"></div>
            <div className="toast-corner bl"></div>
            <div className="toast-corner br"></div>
            <div className="toast-scanline"></div>

            <div className="toast-icon-box">
                <Icon size={18} />
                <Radio size={9} className="toast-live-dot" />
            </div>

            <div className="toast-content">
                <div className="toast-tag">
                    {toast.type === 'announcement' && 'TRANSMISSION'}
                    {toast.type === 'activity' && 'ACTIVITY_LOG'}
                    {toast.type === 'kos' && 'KOS_ALERT'}
                    {toast.type === 'war' && 'WAR_STATUS'}
                    {(!toast.type || toast.type === 'info') && 'SYSTEM'}
                </div>
                <div className="toast-title">{toast.title}</div>
                {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>

            <button className="toast-close" onClick={(e) => {
                e.stopPropagation();
                onDismiss(toast.id);
            }} aria-label="Zamknij powiadomienie">
                <X size={14} />
            </button>

            <div className="toast-progress"></div>
        </motion.div>
    );
};

export default function ToastContainer({ toasts = [], onDismiss }) {
    return (
        <div className="toast-container">
            <AnimatePresence>
                {toasts.map((t) => (
                    <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
                ))}
            </AnimatePresence>
        </div>
    );
}
