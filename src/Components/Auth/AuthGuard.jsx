/* src/Components/Auth/AuthGuard.jsx
 *
 * Ochrona stron wymagających logowania (KOS, WAR LOGS).
 *
 * Sesja pochodzi z SessionContext — tam jest już zwalidowana pod kątem
 * TTL 12h (przeterminowana/niepoprawna = null). Dzięki temu:
 *  - przeterminowana sesja NIGDY nie dostanie dostępu (nawet gdyby
 *    użytkownik cały czas siedział na stronie /kos),
 *  - po wygaśnięciu sesji podczas przeglądania chronionej strony
 *    AuthGuard automatycznie przełącza się na LoginPage (reaktywność).
 */

import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useSession } from '../../Context/SessionContext';

const AuthGuard = ({ children }) => {
    const location = useLocation();
    const { session } = useSession();

    // Zapamiętaj cel powrotu po zalogowaniu (gdy brak sesji).
    useEffect(() => {
        if (!session) {
            sessionStorage.setItem('ZPK_redirect_target', location.pathname + location.search);
        }
    }, [session, location]);

    if (!session) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

export default AuthGuard;
