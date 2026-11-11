/* src/Context/SessionContext.jsx
 *
 * Globalne zarządzanie sesją (ZPK_auth_session) z rotacją tokenów.
 *
 * PROBLEM (bug zgłoszony przez użytkownika):
 *  Wygaśnięcie sesji (TTL 15 min) było sprawdzane TYLKO w AuthGuard —
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
 *  - Automatyczne odświeżanie access tokenu przy użyciu refresh tokenu
 *    (przy 5 min przed wygaśnięciem).
 *  - Session rotation: refresh token ma TTL 7 dni, access token 15 min.
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
    useState,
    useRef
} from 'react';
import {
    SESSION_KEY,
    ACCESS_TOKEN_TTL_MS,
    REFRESH_TOKEN_TTL_MS,
    loadValidSession,
    clearSession,
    clearRefreshToken,
    isSessionValid,
    invalidateSession,
    getSessionMetadata,
    readSession,
    saveSession
} from '../utils/session';

// Re-eksport — testy i konsumenci czytają TTL z SessionContext.
export { ACCESS_TOKEN_TTL_MS as SESSION_TTL_MS, REFRESH_TOKEN_TTL_MS };

// Walidacja sesji (user_id + TTL 15min) mieszka w utils/session.js (vault) —
// jedna polityka ważności dla wszystkich ścieżek (SessionContext,
// SecurityLayer, DiscordCallback). Kontekst tylko ją wywołuje i pilnuje
// auto-logoutu na żywo (licznik 1 s) oraz auto-refreshu tokenów.

const computeTimeLeft = (session) => {
    if (!session || !session.user_id) return null;
    return Math.max(ACCESS_TOKEN_TTL_MS - (Date.now() - (session.timestamp || 0)), 0);
};

// Czas przed wygaśnięciem, gdy uruchamiamy auto-refresh (5 minut)
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
    const [session, setSession] = useState(loadValidSession);
    const [timeLeft, setTimeLeft] = useState(null);
    const [sessionMetadata, setSessionMetadata] = useState(null);
    const refreshTimeoutRef = useRef(null);
    const isRefreshingRef = useRef(false);
    // Ref do przerwania cyklicznej zależności między refreshAccessToken a scheduleTokenRefresh
    const scheduleTokenRefreshRef = useRef(null);

    // Inicjalizuj metadane sesji
    useEffect(() => {
        if (session && session.user_id) {
            setSessionMetadata(getSessionMetadata());
        } else {
            setSessionMetadata(null);
        }
    }, [session]);

    // Funkcja odświeżająca access token przez Netlify Function
    const refreshAccessToken = useCallback(async () => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;

        try {
            const response = await fetch('/.netlify/functions/auth-refresh', {
                method: 'POST',
                credentials: 'include', // Ważne: przesyła HttpOnly cookie
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.accessToken && data.user) {
                    const newSession = {
                        user_id: data.user.id,
                        username: data.user.username,
                        avatar: data.user.avatar,
                        roles: data.user.roles || [],
                        timestamp: Date.now(),
                        ip: data.ip,
                        userAgent: data.userAgent
                    };
                    saveSession(newSession);
                    setSession(newSession);
                    setSessionMetadata(getSessionMetadata());
                    // Zaplanuj kolejny refresh przez ref
                    scheduleTokenRefreshRef.current?.(newSession);
                } else {
                    throw new Error('Invalid refresh response');
                }
            } else if (response.status === 401) {
                // Refresh token wygasł lub nieprawidłowy — wyloguj
                clearSession();
                clearRefreshToken();
                setSession(null);
                setSessionMetadata(null);
            } else {
                throw new Error(`Refresh failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            // W przypadku błędu sieci — spróbuj ponownie za minutę
            refreshTimeoutRef.current = setTimeout(() => {
                refreshAccessToken();
            }, 60 * 1000);
        } finally {
            isRefreshingRef.current = false;
        }
    }, []);

    // Automatyczne odświeżanie access tokenu przed wygaśnięciem
    const scheduleTokenRefresh = useCallback((sessionData) => {
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }

        const timeUntilExpiry = computeTimeLeft(sessionData);
        const timeUntilRefresh = timeUntilExpiry - REFRESH_BEFORE_EXPIRY_MS;

        if (timeUntilRefresh <= 0) {
            // Już czas na refresh — uruchom natychmiast
            refreshAccessToken();
            return;
        }

        refreshTimeoutRef.current = setTimeout(() => {
            refreshAccessToken();
        }, timeUntilRefresh);
    }, [refreshAccessToken]);

    // Przypisz do ref po zdefiniowaniu (przerwanie cyklicznej zależności)
    scheduleTokenRefreshRef.current = scheduleTokenRefresh;

    // Licznik wygasania — co 1 s. Po przekroczeniu TTL sesja jest
    // automatycznie czyszczona (auto-logout BEZ przeładowania strony).
    useEffect(() => {
        if (!session || !session.user_id) {
            setTimeLeft(null);
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            return;
        }

        // Zaplanuj auto-refresh przy starcie
        scheduleTokenRefresh(session);

        const update = () => {
            const remaining = computeTimeLeft(session);
            if (remaining <= 0) {
                // Sprawdź czy można odświeżyć
                const validation = isSessionValid();
                if (validation.needsRefresh) {
                    // Refresh zostanie obsłużony przez scheduleTokenRefresh
                    return;
                }
                clearSession();
                clearRefreshToken();
                setSession(null);
                setSessionMetadata(null);
            } else {
                setTimeLeft(remaining);
            }
        };
        update();
        const interval = setInterval(update, 1000);
        return () => {
            clearInterval(interval);
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [session, scheduleTokenRefresh]);

    // Synchronizacja między kartami — logout/zalogowanie w innej karcie
    // (zdarzenie storage nie działa w tej samej karcie, ale to nie szkodzi).
    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === SESSION_KEY || e.key === 'ZPK_refresh_token' || e.key === null) {
                const validation = isSessionValid();
                if (validation.session) {
                    setSession(validation.session);
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
                    clearRefreshToken();
                    setSession(null);
                    setSessionMetadata(null);
                }
            }
        };

        window.addEventListener('ZPK:sessionInvalidated', handleSessionInvalidated);
        return () => window.removeEventListener('ZPK:sessionInvalidated', handleSessionInvalidated);
    }, []);

    const logout = useCallback(() => {
        clearSession();
        clearRefreshToken();
        sessionStorage.removeItem('ZPK_redirect_target');
        setSession(null);
        setSessionMetadata(null);
        // PELNY reload na czysty URL — inaczej (np. będąc już na #/),
        // sam link hash niczego nie zmienia i aplikacja zostaje w starym,
        // częściowo wylogowanym stanie (np. zamrożony ekran ładowania).
        // Reload resetuje cały stan (App, AuthGuard, realtime) i wraca
        // na stronę główną jako gość.
        window.location.replace(window.location.origin + window.location.pathname + '#/');
    }, []);

    // Unieważnij sesję (dla password change, role change, logout all devices)
    const invalidateSessionFn = useCallback((reason = 'manual') => {
        invalidateSession(reason);
        // Wyślij event do innych kart
        window.dispatchEvent(new CustomEvent('ZPK:sessionInvalidated', {
            detail: { userId: session?.user_id, reason }
        }));
        setSession(null);
        setSessionMetadata(null);
    }, [session]);

    const value = useMemo(
        () => ({
            session,
            timeLeft,
            logout,
            invalidateSession: invalidateSessionFn,
            sessionMetadata,
            isLoggedIn: !!(session && session.user_id)
        }),
        [session, timeLeft, logout, invalidateSessionFn, sessionMetadata]
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
        return {
            session: null,
            timeLeft: null,
            logout: () => {},
            invalidateSession: () => {},
            sessionMetadata: null,
            isLoggedIn: false
        };
    }
    return ctx;
};

export default SessionProvider;