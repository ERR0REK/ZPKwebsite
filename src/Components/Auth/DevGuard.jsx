/* src/Components/Auth/DevGuard.jsx
 * Bramka dla WERSJI DEWELOPERSKIEJ (dev-zpkwebsite.netlify.app).
 *
 * Cała strona dev jest dostępna TYLKO dla użytkowników, którzy:
 *   1) zalogowali się przez Discorda ORAZ
 *   2) należą do serwera deweloperskiego frakcji (is_dev_member === true).
 *
 * Każdy inny (niezalogowany albo spoza dev-serwera) zobaczy LoginPage
 * z informacją o ograniczeniu dostępu. To realizuje wymóg:
 * "kto wejdzie na dev zamiast official — dostanie blokadę".
 *
 * Uwaga: DevGuard czyta sesję ZAPISANĄ przy logowaniu — jeśli użytkownik
 * zalogował się na domenie produkcyjnej (official), flaga is_dev_member
 * i tak jest w sesji, ale to DevGuard + weryfikacja w DiscordCallback
 * rozstrzygają dostęp na domenie dev.
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';

import LoadingScreen from '../LoadingScreen/LoadingScreen';

const readSession = () => {
  try {
    const raw = localStorage.getItem('ZPK_auth_session');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

const DevGuard = ({ children }) => {
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        const session = readSession();

        if (session && session.user_id && session.is_dev_member === true) {
            // Zalogowany + zweryfikowany członek serwera deweloperskiego
            setIsAuthenticated(true);
            setIsVerifying(false);
        } else {
            // Niezalogowany / spoza dev-serwera — zapamiętaj cel powrotu
            sessionStorage.setItem('ZPK_redirect_target', location.pathname + location.search);
            setIsVerifying(false);
        }
    }, [location]);

    if (isVerifying) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return <LoginPage devMode />;
    }

    return <>{children}</>;
};

export default DevGuard;
