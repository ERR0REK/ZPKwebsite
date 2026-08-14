/* src/Realtime/RealtimeProvider.jsx
 * Warstwa real-time (Ably) — bez AI, czyste WebSockety.
 *
 * 🔐 TOKEN AUTH (bezpieczny wzorzec Ably + Netlify):
 *  - Frontend NIE dostaje żadnego klucza Ably do bundla.
 *  - Łączy się przez authUrl → funkcja /api/ably-token-request
 *    generuje krótkożyjący token (TTL 1h, tylko subscribe) z klucza ROOT,
 *    który nigdy nie opuszcza backendu.
 *  - Fallback: na localhost (dev bez wdrożonej funkcji) używamy klucza
 *    subscribe-only z .env.local. Jeśli token auth padnie na produkcji,
 *    a klucz subscribe jest dostępny — łączymy się nim.
 * - Publikacja (nadawanie ogłoszeń, zmiany KOS) idzie przez funkcje Netlify
 *   z kluczem ROOT (ABLY_API_KEY po stronie serwera).
 * - Gdy wszystko padnie → status 'off', strona działa normalnie (zero crashy).
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

// Klucz frontendu (subscribe-only) — tylko jako FALLBACK (localhost / awaria
// token auth). Na produkcji klucz w ogóle nie powinien być w bundlu.
const SUB_KEY = (process.env.REACT_APP_ABLY_SUBSCRIBE_KEY || '').trim();

// Endpoint wydający krótkożyjące tokeny (Netlify function).
const TOKEN_AUTH_URL = '/api/ably-token-request';

// Nazwy kanałów — wspólne dla frontendu i funkcji Netlify.
export const CHANNELS = {
    announcements: 'zpk-announcements',
    activity: 'zpk-activity',
    kos: 'zpk-kos-updates',
    presence: 'zpk-presence',
    war: 'zpk-war-status',
    discord: 'zpk-discord-stats'
};

// Localhost = dev bez wdrożonej funkcji token → używamy klucza subscribe.
const isLocalhost = () =>
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Wspólny filtr logów SDK (kosmetyczne "Connection closed" — nie błąd).
const ablyLog = {
    level: 4,
    handler: (msg) => {
        if (msg && msg.indexOf('Connection closed') !== -1) return;
        console.log('[Ably]', msg);
    }
};

export function RealtimeProvider({ children }) {
    const [status, setStatus] = useState('off'); // off | connecting | online | error
    const [lastError, setLastError] = useState(null); // powód braku połączenia (diagnostyka)
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

    // Połączenie z Ably — TOKEN AUTH na produkcji, klucz na localhost.
    useEffect(() => {
        const AblySDK = getAblySDK();
        if (!AblySDK || !AblySDK.Realtime) {
            // SDK się nie załadował — strona działa normalnie, bez realtime.
            setStatus('off');
            setLastError('SDK_MISSING');
            return;
        }

        let detach = () => {};

        // Na produkcji: jeśli token auth padnie, próbujemy klucz subscribe.
        let allowKeyFallback = !isLocalhost() && !!SUB_KEY;

        const connect = (options) => {
            detach();
            let c;
            try {
                c = new AblySDK.Realtime({ echoMessages: false, log: ablyLog, ...options });
            } catch (err) {
                console.warn('[Realtime] init failed:', err);
                setStatus('error');
                return;
            }
            clientRef.current = c;
            setStatus('connecting');

            const onConnected = () => {
                setStatus('online');
                setLastError(null);
                // dołącz oczekujące handlery
                pendingRef.current.forEach((handlers, name) => {
                    const channel = c.channels.get(name);
                    handlers.forEach((cb) => channel.subscribe(cb));
                });
                pendingRef.current = new Map();
            };
            const onOffline = () => setStatus('off');
            const onFailed = (stateChange) => {
                const reason =
                    (stateChange && stateChange.reason && stateChange.reason.message) ||
                    (stateChange && stateChange.reason && stateChange.reason.code) ||
                    'CONNECTION_FAILED';
                setLastError(String(reason).slice(0, 80));
                if (allowKeyFallback) {
                    allowKeyFallback = false; // próbuj tylko raz
                    connect({ key: SUB_KEY });
                } else {
                    setStatus('error');
                }
            };

            c.connection.on('connected', onConnected);
            c.connection.on('disconnected', onOffline);
            c.connection.on('suspended', onOffline);
            c.connection.on('failed', onFailed);

            detach = () => {
                c.connection.off('connected', onConnected);
                c.connection.off('disconnected', onOffline);
                c.connection.off('suspended', onOffline);
                c.connection.off('failed', onFailed);
                c.close();
            };
        };

        if (isLocalhost()) {
            // Dev bez wdrożonej funkcji token — klucz subscribe z .env.local
            if (SUB_KEY) connect({ key: SUB_KEY });
            else {
                setStatus('off');
                setLastError('NO_SUB_KEY_LOCAL');
            }
        } else {
            // Produkcja — token auth, klucz nigdy nie trafia do przeglądarki
            connect({ authUrl: TOKEN_AUTH_URL, authMethod: 'GET' });
        }

        return () => {
            detach();
            clientRef.current = null;
            // Czyść oczekujące handlery — inaczej w dev (StrictMode double-mount)
            // mogą zostać zduplikowane po ponownym połączeniu.
            pendingRef.current = new Map();
        };
    }, []);

    // Automatyczne toasty z kanałów ogłoszeń i aktywności
    useEffect(() => {
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
            isConnecting: status === 'connecting',
            lastError,
            subscribe,
            pushToast,
            dismissToast
        }),
        [status, lastError, subscribe, pushToast, dismissToast]
    );

    return (
        <RealtimeContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </RealtimeContext.Provider>
    );
}
