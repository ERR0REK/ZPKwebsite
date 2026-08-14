import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';

import LoadingScreen from '../LoadingScreen/LoadingScreen';

// Czas życia sesji — po tym czasie wymagamy ponownego logowania.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 godzin

const readSession = () => {
  try {
    const raw = localStorage.getItem('ZPK_auth_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const AuthGuard = ({ children }) => {
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        const session = readSession();

        if (session && session.access_token) {
            if (!session.user_id) {
                // Old session format without ID - force re-login
                localStorage.removeItem('ZPK_auth_session');
                setIsVerifying(false);
                return;
            }

            // Wygasanie sesji — jeśli token jest starszy niż TTL, wyloguj.
            const sessionAge = Date.now() - (session.timestamp || 0);
            if (sessionAge > SESSION_TTL_MS) {
                localStorage.removeItem('ZPK_auth_session');
                sessionStorage.setItem('ZPK_redirect_target', location.pathname + location.search);
                setIsVerifying(false);
                return;
            }

            setIsAuthenticated(true);
            setIsVerifying(false);
        } else {
            // Save the current path to return to after login
            sessionStorage.setItem('ZPK_redirect_target', location.pathname + location.search);
            setIsVerifying(false);
        }
    }, [location]);

    if (isVerifying) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

export default AuthGuard;
