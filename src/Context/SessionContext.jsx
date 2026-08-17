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

// Czas życia sesji — MUSI być spójny z pozostałymi miejscami (12h).
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_KEY = 'ZPK_auth_session';

// Czyta sesję z localStorage i natychmiast weryfikuje:
//  - poprawny JSON + obecność user_id (stary format → usuń),
//  - wiek sesji (TTL 12h — przeterminowana → usuń).
// Dzięki temu kontekst NIGDY nie pokazuje przeterminowanej sesji,
// nawet w pierwszym renderze (sedno buga: navbar pokazywał zalogowanego
// użytkownika z wygasłą sesją dopóki ktoś nie wszedł na /kos).
const readSession = () => {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        if (!session || !session.user_id) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        const age = Date.now() - (session.timestamp || 0);
        if (age > SESSION_TTL_MS) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    } catch (e) {
        // Zepsuty JSON (np. ręczna edycja localStorage) — czyść i ignoruj.
        try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* noop */ }
        return null;
    }
};

const computeTimeLeft = (session) => {
    if (!session || !session.user_id) return null;
    return Math.max(SESSION_TTL_MS - (Date.now() - (session.timestamp || 0)), 0);
};

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(readSession);
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
                localStorage.removeItem(SESSION_KEY);
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
                setSession(readSession());
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(SESSION_KEY);
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
