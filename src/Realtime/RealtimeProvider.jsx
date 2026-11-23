/* src/Realtime/RealtimeProvider.jsx
 * Warstwa real-time (Ably) — bez AI, czyste WebSockety.
 * Używa @ably/pubsub-device (v3) przez UMD global window.AblyPubSub.
 *
 * 🔐 TOKEN AUTH (bezpieczny wzorzec Ably + Netlify):
 *  - Frontend NIE dostaje żadnego klucza Ably do bundla.
 *  - Łączy się przez authCallback → funkcja /api/ably-token-request
 *    generuje krótkożyjący token (TTL 1h, tylko subscribe) z klucza ROOT,
 *    który nigdy nie opuszcza backendu.
 *  - Token zawiera clientId (Discord user ID) — wymagane na kontach MAU.
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

// Ably v3 UMD ładuje się przez <script> w index.html jako window.AblyPubSub
// Omija to kompilację Babel w CRA (brak @babel/plugin-transform-classes).
const getAblySDK = () => (typeof window !== 'undefined' ? window.AblyPubSub : undefined);

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

// Kanały, które obsługują historię (pomijamy presence i discord)
const HISTORY_CHANNELS = [
    CHANNELS.announcements,
    CHANNELS.activity,
    CHANNELS.kos,
    CHANNELS.war
];

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
    const [presenceMembers, setPresenceMembers] = useState([]);
    const clientRef = useRef(null);
    const presenceRef = useRef(null);
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

    // Pobiera aktualnych członków presence (zwraca tablicę)
    const getPresence = useCallback(() => {
        return presenceMembers;
    }, [presenceMembers]);

    // Funkcja do aktualizacji danych presence (username, avatar)
    const updatePresence = useCallback(async (userData) => {
        if (!presenceRef.current) return;
        try {
            await presenceRef.current.presence.update(userData);
        } catch (err) {
            console.warn('[Realtime] Presence update failed:', err);
        }
    }, []);

    // Pobierz clientId z localStorage (Discord user ID) lub wygeneruj anon
    const getClientId = useCallback(() => {
        if (typeof window === 'undefined') return null;
        // Spróbuj pobrać z localStorage (ustawiane po logowaniu Discord)
        const stored = localStorage.getItem('zpk_discord_user_id');
        if (stored) return `user-${stored}`;
        // Fallback: anon ID trzymany w sessionStorage
        let anonId = sessionStorage.getItem('zpk_anon_client_id');
        if (!anonId) {
            anonId = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            sessionStorage.setItem('zpk_anon_client_id', anonId);
        }
        return anonId;
    }, []);

    // Połączenie z Ably — TOKEN AUTH na produkcji, klucz na localhost.
    useEffect(() => {
        const AblySDK = getAblySDK();
        if (!AblySDK || !AblySDK.createClient) {
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
                // v3: createClient zamiast new Realtime()
                c = AblySDK.createClient({ echoMessages: false, log: ablyLog, ...options });
            } catch (err) {
                console.warn('[Realtime] init failed:', err);
                setStatus('error');
                return;
            }
            clientRef.current = c;
            setStatus('connecting');

            const onConnected = async () => {
                setStatus('online');
                setLastError(null);

                // --- PRESENCE ---
                try {
                    const presenceChannel = c.channels.get(CHANNELS.presence);
                    presenceRef.current = presenceChannel;

                    // Dane klienta do presence (clientId pochodzi z tokena)
                    const clientData = {
                        clientId: c.auth.clientId || `client-${Date.now()}`,
                        timestamp: Date.now()
                    };

                    // Wejście w presence
                    await presenceChannel.presence.enter(clientData);

                    // Subskrypcja zdarzeń presence
                    const handleEnter = (member) => {
                        setPresenceMembers((prev) => {
                            const exists = prev.some((m) => m.clientId === member.clientId);
                            if (exists) return prev;
                            return [...prev, { clientId: member.clientId, data: member.data, timestamp: Date.now() }];
                        });
                    };

                    const handleLeave = (member) => {
                        setPresenceMembers((prev) =>
                            prev.filter((m) => m.clientId !== member.clientId)
                        );
                    };

                    const handleUpdate = (member) => {
                        setPresenceMembers((prev) =>
                            prev.map((m) =>
                                m.clientId === member.clientId ? { ...m, data: member.data, timestamp: Date.now() } : m
                            )
                        );
                    };

                    presenceChannel.presence.subscribe('enter', handleEnter);
                    presenceChannel.presence.subscribe('leave', handleLeave);
                    presenceChannel.presence.subscribe('update', handleUpdate);

                    // Pobierz aktualnych członków
                    const members = await presenceChannel.presence.get();
                    setPresenceMembers(
                        members.map((m) => ({
                            clientId: m.clientId,
                            data: m.data,
                            timestamp: Date.now()
                        }))
                    );
                } catch (err) {
                    console.warn('[Realtime] Presence init failed:', err);
                }

                // --- HISTORY ---
                for (const channelName of HISTORY_CHANNELS) {
                    try {
                        const channel = c.channels.get(channelName);
                        // Attach channel first (untilAttach requires attached state)
                        await channel.attach();
                        const history = await channel.history({ limit: 50 });
                        // Replay w kolejności chronologicznej (od najstarszych)
                        history.items.reverse().forEach((msg) => channel.emit(msg.name, msg));
                    } catch (err) {
                        console.warn(`[Realtime] History fetch failed for ${channelName}:`, err);
                    }
                }

                // dołącz oczekujące handlery
                pendingRef.current.forEach((handlers, name) => {
                    const channel = c.channels.get(name);
                    handlers.forEach((cb) => channel.subscribe(cb));
                });
                pendingRef.current = new Map();
            };

            // Token auth fallback: jeśli token auth nie zadziała (ORB, CORS, sieć),
            // spróbuj ponownie kluczem subscribe-only. Max 2 próby
            // żeby uniknąć pętli (token auth → fail → key → fail → loop).
            let fallbackAttempts = 0;
            const MAX_FALLBACK = 2;
            const tryFallback = (reason) => {
                setLastError(String(reason).slice(0, 80));
                if (allowKeyFallback && fallbackAttempts < MAX_FALLBACK) {
                    fallbackAttempts++;
                    allowKeyFallback = false; // klucz jako ostatnia deska ratunku
                    connect({ key: SUB_KEY });
                } else {
                    setStatus('error');
                }
            };

            const onOffline = () => {
                // suspended/disconnected z token auth = prawdopodobnie ORB/CORS → fallback
                if (allowKeyFallback && fallbackAttempts === 0) {
                    tryFallback('CONNECTION_SUSPENDED');
                } else {
                    setStatus('off');
                }
            };
            const onFailed = (stateChange) => {
                const reason =
                    (stateChange && stateChange.reason && stateChange.reason.message) ||
                    (stateChange && stateChange.reason && stateChange.reason.code) ||
                    'CONNECTION_FAILED';
                tryFallback(reason);
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

                // Cleanup presence
                if (presenceRef.current) {
                    try {
                        presenceRef.current.presence.leave();
                    } catch (err) {
                        console.warn('[Realtime] Presence leave failed:', err);
                    }
                    presenceRef.current = null;
                }

                // v3: close() jest bezpieczne, SDK sam zarządza promise
                try {
                    c.close();
                } catch (err) {
                    ablyLog && console.warn('[Realtime] close() — połączenie już martwe:', String(err).slice(0, 60));
                }
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
            // Produkcja — token auth przez authCallback (fetch) z clientId.
            // authCallback używa własnego fetch(), który nie podlega ORB.
            const clientId = getClientId();
            connect({
                authCallback: async (tokenParams, callback) => {
                    try {
                        // Prześlij clientId do backendu — wymagane na MAU
                        const params = { ...tokenParams, recover: 'last', clientId };
                        const res = await fetch(TOKEN_AUTH_URL, {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(params)
                        });
                        if (!res.ok) {
                            callback(new Error(`Token auth failed: ${res.status}`));
                            return;
                        }
                        const tokenRequest = await res.json();
                        callback(null, tokenRequest);
                    } catch (err) {
                        callback(err);
                    }
                }
            });
        }

        return () => {
            detach();
            clientRef.current = null;
            // Czyść oczekujące handlery — inaczej w dev (StrictMode double-mount)
            // mogą zostać zduplikowane po ponownym połączeniu.
            pendingRef.current = new Map();
            setPresenceMembers([]);
        };
    }, [getClientId]);

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
            dismissToast,
            presenceMembers,
            getPresence,
            updatePresence
        }),
        [status, lastError, subscribe, pushToast, dismissToast, presenceMembers, getPresence, updatePresence]
    );

    return (
        <RealtimeContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </RealtimeContext.Provider>
    );
}