/* src/Realtime/RealtimeProvider.jsx
 * Warstwa real-time (Ably) — bez AI, czyste WebSockety.
 *
 * - Client łączy się z kluczem SUBSCRIBE-ONLY (REACT_APP_ABLY_SUBSCRIBE_KEY)
 *   → przeglądarka może tylko SŁUCHAĆ kanałów, nie publikować.
 * - Publikacja (nadawanie ogłoszeń, zmiany KOS) idzie przez funkcje Netlify
 *   z kluczem ROOT (ABLY_API_KEY po stronie serwera).
 * - Gdy klucza brak lub WebSocket padnie → status 'off', strona działa
 *   dalej normalnie (zero crashy, zero pustek).
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useCallback
} from 'react';
import ToastContainer from '../Components/Toasts/ToastContainer';

// Ably jest ładowane jako gotowy plik UMD (public/vendor/ably.min.js)
// przez <script> w index.html — omija to kompilację Babel w CRA, która
// wywalałaby build (brak @babel/plugin-transform-classes w node_modules).
// W przeglądarce SDK jest dostępne jako global window.Ably.
const getAblySDK = () => (typeof window !== 'undefined' ? window.Ably : undefined);

const RealtimeContext = createContext(null);

export const useRealtime = () => useContext(RealtimeContext);

// Klucz frontendu (subscribe-only) — czytany z .env.local (gitignored).
const SUB_KEY = (process.env.REACT_APP_ABLY_SUBSCRIBE_KEY || '').trim();

// Nazwy kanałów — wspólne dla frontendu i funkcji Netlify.
export const CHANNELS = {
    announcements: 'zpk-announcements',
    activity: 'zpk-activity',
    kos: 'zpk-kos-updates',
    presence: 'zpk-presence',
    war: 'zpk-war-status',
    discord: 'zpk-discord-stats'
};

export function RealtimeProvider({ children }) {
    const [status, setStatus] = useState('off'); // off | connecting | online | error
    const [toasts, setToasts] = useState([]);
    const clientRef = useRef(null);
    const pendingRef = useRef(new Map()); // kanał -> Set(handlerów oczekujących na połączenie)

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const pushToast = useCallback((toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setToasts((prev) => [...prev.slice(-4), { ...toast, id }]);
        // Auto-zniknięcie po 8 s
        setTimeout(() => dismissToast(id), 8000);
    }, [dismissToast]);

    // Subskrypcja kanału. Zwraca funkcję odsubskrybowania.
    // Działa też przed połączeniem — handler wisi w kolejce do 'connected'.
    const subscribe = useCallback((channelName, callback) => {
        const client = clientRef.current;
        if (!client) {
            const set = pendingRef.current.get(channelName) || new Set();
            set.add(callback);
            pendingRef.current.set(channelName, set);
            return () => {
                const s = pendingRef.current.get(channelName);
                if (s) s.delete(callback);
            };
        }
        const channel = client.channels.get(channelName);
        channel.subscribe(callback);
        return () => channel.unsubscribe(callback);
    }, []);

    // Połączenie z Ably (klucz subscribe-only)
    useEffect(() => {
        const AblySDK = getAblySDK();
        if (!SUB_KEY || !AblySDK || !AblySDK.Realtime) {
            // Brak klucza lub SDK się nie załadował — strona działa normalnie,
            // po prostu bez realtime (fallback: status 'off', zero crashy).
            setStatus('off');
            return;
        }
        let client;
        try {
            client = new AblySDK.Realtime({
                key: SUB_KEY,
                echoMessages: false,
                // Wyciszamy kosmetyczne "Connection closed" z SDK — to normalne
                // zamknięcie (np. przy StrictMode double-mount w dev), nie błąd.
                // Prawdziwe problemy (błędy sieci, auth) nadal się logują.
                log: {
                    level: 4,
                    handler: (msg) => {
                        if (msg && msg.indexOf('Connection closed') !== -1) return;
                        console.log('[Ably]', msg);
                    }
                }
            });
        } catch (err) {
            console.warn('[Realtime] init failed:', err);
            setStatus('error');
            return;
        }
        clientRef.current = client;
        setStatus('connecting');

        const onConnected = () => {
            setStatus('online');
            // dołącz oczekujące handlery
            pendingRef.current.forEach((handlers, name) => {
                const channel = client.channels.get(name);
                handlers.forEach((cb) => channel.subscribe(cb));
            });
            pendingRef.current = new Map();
        };
        const onOffline = () => setStatus('off');
        const onFailed = () => setStatus('error');

        client.connection.on('connected', onConnected);
        client.connection.on('disconnected', onOffline);
        client.connection.on('suspended', onOffline);
        client.connection.on('failed', onFailed);

        return () => {
            client.connection.off('connected', onConnected);
            client.connection.off('disconnected', onOffline);
            client.connection.off('suspended', onOffline);
            client.connection.off('failed', onFailed);
            client.close();
            clientRef.current = null;
            // Czyść oczekujące handlery — inaczej w dev (StrictMode double-mount)
            // mogą zostać zduplikowane po ponownym połączeniu.
            pendingRef.current = new Map();
        };
    }, []);

    // Automatyczne toasty z kanałów ogłoszeń i aktywności
    useEffect(() => {
        if (!SUB_KEY) return;
        const offAnnounce = subscribe(CHANNELS.announcements, (msg) => {
            const d = msg.data || {};
            pushToast({
                type: 'announcement',
                title: d.title || 'ANNOUNCEMENT',
                message: d.message || '',
                severity: d.severity || 'info'
            });
        });
        const offActivity = subscribe(CHANNELS.activity, (msg) => {
            const d = msg.data || {};
            pushToast({
                type: 'activity',
                title: d.title || 'ACTIVITY_LOG',
                message: d.message || '',
                severity: d.severity || 'info'
            });
        });
        const offKos = subscribe(CHANNELS.kos, (msg) => {
            const d = msg.data || {};
            pushToast({
                type: 'kos',
                title: d.title || 'KOS_UPDATE',
                message: d.message || '',
                severity: d.severity || 'warning'
            });
        });
        const offWar = subscribe(CHANNELS.war, (msg) => {
            const d = msg.data || {};
            pushToast({
                type: 'war',
                title: d.title || 'WAR_STATUS',
                message: d.message || '',
                severity: d.severity || 'info'
            });
        });
        return () => {
            offAnnounce();
            offActivity();
            offKos();
            offWar();
        };
    }, [subscribe, pushToast]);

    const value = useMemo(
        () => ({
            status,
            isOnline: status === 'online',
            subscribe,
            pushToast,
            dismissToast
        }),
        [status, subscribe, pushToast, dismissToast]
    );

    return (
        <RealtimeContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </RealtimeContext.Provider>
    );
}
