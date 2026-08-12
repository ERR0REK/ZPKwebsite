import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPage from './LoginPage';

import LoadingScreen from '../LoadingScreen/LoadingScreen';

const AuthGuard = ({ children }) => {
    const location = useLocation();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);

    useEffect(() => {
        const session = JSON.parse(localStorage.getItem('ZPK_auth_session'));

        if (session && session.access_token) {
            if (!session.user_id) {
                // Old session format without ID - force re-login
                localStorage.removeItem('ZPK_auth_session');
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
