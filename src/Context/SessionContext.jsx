/* src/Context/SessionContext.jsx
 *
 * Globalne zarządzanie sesją (ZPK_auth_session).
 *
 * PROBLEM (bug zgłoszony przez użytkownika):
 *  Wygaśnięcie sesji (TTL 12h) było sprawdzane TYLKO w AuthGuard —
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
import { SESSION_KEY, SESSION_TTL_MS, loadValidSession, clearSession } from '../utils/session';

// Re-eksport — testy i konsumenci czytają TTL z SessionContext.
export { SESSION_TTL_MS };

// Walidacja sesji (user_id + TTL 12h) mieszka w utils/session.js (vault) —
// jedna polityka ważności dla wszystkich ścieżek (SessionContext,
// SecurityLayer, DiscordCallback). Kontekst tylko ją wywołuje i pilnuje
// auto-logoutu na żywo (licznik 1 s).

const computeTimeLeft = (session) => {
    if (!session || !session.user_id) return null;
    return Math.max(SESSION_TTL_MS - (Date.now() - (session.timestamp || 0)), 0);
};

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(loadValidSession);
    const [timeLeft, setTimeLeft] = useState(null);

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
                setSession(loadValidSession());
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const logout = useCallback(() => {
        clearSession();
        sessionStorage.removeItem('ZPK_redirect_target');
        setSession(null);
        // PELNY reload na czysty URL — inaczej (np. będąc już na #/),
        // sam link hash niczego nie zmienia i aplikacja zostaje w starym,
        // częściowo wylogowanym stanie (np. zamrożony ekran ładowania).
        // Reload resetuje cały stan (App, AuthGuard, realtime) i wraca
        // na stronę główną jako gość.
        window.location.replace(window.location.origin + window.location.pathname + '#/');
    }, []);

    const value = useMemo(
        () => ({
            session,
            timeLeft,
            logout,
            isLoggedIn: !!(session && session.user_id)
        }),
        [session, timeLeft, logout]
    );

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const ctx = useContext(SessionContext);
    if (!ctx) {
        // Fallback (np. testy jednostkowe bez providera) — bezpieczne zera.
        return { session: null, timeLeft: null, logout: () => {}, isLoggedIn: false };
    }
    return ctx;
};

export default SessionProvider;
