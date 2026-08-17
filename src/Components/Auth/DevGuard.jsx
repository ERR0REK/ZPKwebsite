/* src/Components/Auth/DevGuard.jsx
 * Bramka dla WERSJI DEWELOPERSKIEJ (dev-zpkwebsite.netlify.app).
 *
 * UWAGA: aktywna implementacja DevGuarda znajduje się w App.jsx
 * (inline). Ten plik jest utrzymywany jako spójna kopia na wypadek
 * ponownego użycia — korzysta z SessionContext, więc wygasła sesja
 * (TTL 12h) automatycznie prowadzi do LoginPage.
 *
 * Cała strona dev jest dostępna TYLKO dla użytkowników, którzy:
 *   1) zalogowali się przez Discorda ORAZ
 *   2) należą do serwera deweloperskiego frakcji (is_dev_member === true).
 */

import React from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useSession } from '../../Context/SessionContext';

const DevGuard = ({ children }) => {
    const location = useLocation();
    // Sesja z kontekstu jest już zwalidowana pod TTL 12h.
    const { session } = useSession();
    const isAuthenticated = !!(session && session.user_id && session.is_dev_member === true);

    if (!isAuthenticated) {
        // Zapamiętaj cel powrotu — ale nie nadpisuj, jeśli już ustawiony.
        sessionStorage.setItem('ZPK_redirect_target', location.pathname + location.search);
        return <LoginPage devMode />;
    }

    return <>{children}</>;
};

export default DevGuard;
