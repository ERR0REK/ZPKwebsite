/* src/Context/SessionContext.jsx
 *
 * Globalne zarządzanie sesją (ZPK_auth_session).
 *
 * PROBLEM (bug zgłoszony przez użytkownika):
 *  Wygaśnięcie sesji (TTL) było sprawdzane TYLKO w AuthGuard —
 *  czyli dopiero po wejściu na /kos lub /war-logs. Na pozostałych
 *  stronach (np. strona główna) użytkownik z wygasłą sesją nadal
 *  wyglądał na zalogowanego (badge z avatarem), aż do kliknięcia
 *  w chronioną stronę.
 *
 * ROZWIĄZANIE:
 *  - Sesja jest czytana i WALIDOWANA (TTL + poprawność) już przy
 *    pierwszym renderze providera — przeterminowana sesja nigdy nie
 *    trafia do UI.
 *  - Licznik co 1 s sprawdza wygasanie na ŻYWO. Po przekroczeniu TTL
 *    sesja jest usuwana z localStorage i z kontekstu (auto-logout)
 *    BEZ przeładowania strony — użytkownik dalej może przeglądać
 *    publiczne strony jako gość, a chronione (KOS / WAR LOGS) przez
 *    AuthGuard natychmiast pokażą LoginPage.
 *  - Używamy Implicit Flow (Discord OAuth) — brak refresh tokena,
 *    sesja wygasa po czasie z tokena Discorda (domyślnie 7 dni).
 *    Po wygaśnięciu użytkownik loguje się ponownie.
 *  - Unieważnianie sesji przy zmianie hasła/roli/wylogowaniu ze wszystkich urządzeń.
 *  - Metadane sesji (IP, UA, created_at) do wykrywania anomalii.
 *  - logout() zachowuje dotychczasowe zachowanie: pełny reload na
 *    czysty URL #/ (reset całego stanu aplikacji).
 */

import React, {
    createContext,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
import {
    SESSION_KEY,
    ACCESS_TOKEN_TTL_MS,
    loadValidSession,
    clearSession,
    invalidateSession,
    getSessionMetadata,
    readSession
} from '../utils/session';

// Re-eksport — testy i konsumenci czytają TTL z SessionContext.
export { ACCESS_TOKEN_TTL_MS as SESSION_TTL_MS };

// Walidacja sesji (user_id + TTL) mieszka w utils/session.js (vault) —
// jedna polityka ważności dla wszystkich ścieżek (SessionContext,
// SecurityLayer, DiscordCallback). Kontekst tylko ją wywołuje i pilnuje
// auto-logoutu na żywo (licznik 1 s).

const computeTimeLeft = (session) => {
    if (!session || !session.user_id) return null;
    // Użyj expires_in z sesji jeśli dostępne, fallback na ACCESS_TOKEN_TTL_MS
    const ttl = session.expires_in ? session.expires_in * 1000 : ACCESS_TOKEN_TTL_MS;
    return Math.max(ttl - (Date.now() - (session.timestamp || 0)), 0);
};

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(loadValidSession);
    const [timeLeft, setTimeLeft] = useState(null);
    const [sessionMetadata, setSessionMetadata] = useState(null);

    // Inicjalizuj metadane sesji
    useEffect(() => {
        if (session && session.user_id) {
            setSessionMetadata(getSessionMetadata());
        } else {
            setSessionMetadata(null);
        }
    }, [session]);

    // Licznik wygasania — co 1 s. Po przekroczeniu TTL sesja jest
    // automatycznie czyszczona (auto-logout BEZ przeładowania strony).
    useEffect(() => {
        if (!session || !session.user_id) {
            setTimeLeft(null);
            return;
        }

        const update = () => {
            const remaining = computeTimeLeft(session);
            if (remaining <= 0) {
                clearSession();
                setSession(null);
                setSessionMetadata(null);
            } else {
                setTimeLeft(remaining);
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [session]);

    // Synchronizacja między kartami — logout/zalogowanie w innej karcie
    // (zdarzenie storage nie działa w tej samej karcie, ale to nie szkodzi).
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === SESSION_KEY || e.key === null) {
                const validSession = loadValidSession();
                if (validSession) {
                    setSession(validSession);
                } else {
                    setSession(null);
                }
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    // Nasłuchuj zdarzeń unieważnienia sesji z innych kart/urządzeń
    useEffect(() => {
        const handleSessionInvalidated = (event) => {
            if (event.detail && event.detail.userId) {
                const currentSession = readSession();
                if (currentSession && currentSession.user_id === event.detail.userId) {
                    clearSession();
                    setSession(null);
                    setSessionMetadata(null);
                }
            }
        };

        window.addEventListener('ZPK:sessionInvalidated', handleSessionInvalidated);
        return () => window.removeEventListener('ZPK:sessionInvalidated', handleSessionInvalidated);
    }, []);

    // Wylogowanie — czyści sesję i robi pełny reload na czysty URL
    const logout = useCallback(() => {
        clearSession();
        setSession(null);
        setSessionMetadata(null);
        setTimeLeft(null);
        // Pełny reload na czysty URL (bez hasha) — reset całego stanu
        window.location.replace(window.location.origin + window.location.pathname + '#/');
    }, []);

    // Ręczne unieważnienie (password change, role change, logout all devices)
    const invalidate = useCallback((reason = 'manual') => {
        invalidateSession(reason);
        setSession(null);
        setSessionMetadata(null);
        setTimeLeft(null);
    }, []);

    const value = useMemo(
        () => ({
            session,
            timeLeft,
            sessionMetadata,
            isLoggedIn: !!session?.user_id,
            logout,
            invalidate
        }),
        [session, timeLeft, sessionMetadata, logout, invalidate]
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};