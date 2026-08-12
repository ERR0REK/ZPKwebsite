// src/Components/Navbar/Navbar.jsx

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logo from '../../Assets/logo.png';
import './Navbar.css';

const Navbar = () => {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const location = useLocation();

    // Close menu when route changes
    useEffect(() => {
        setIsMenuOpen(false);
    }, [location]);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    /* Logout button disabled temporarily
    const handleLogout = () => {
        localStorage.removeItem('ZPK_auth_session');
        window.location.href = "/";
    };
    */

    return (
        <nav>
            <div className="nav-container">
                {/* --- LEWA STRONA (Logo i Nazwa) --- */}
                <div className="nav-left">
                    <NavLink to="/">
                        <img src={logo} alt={t('common.orgName')} className='logo' />
                    </NavLink>
                    <NavLink to="/" className='name'>
                        {t('common.orgName')}
                    </NavLink>
                </div>

                {/* --- HAMBURGER MENU (Mobile) --- */}
                <div className={`hamburger ${isMenuOpen ? 'active' : ''}`} onClick={toggleMenu}>
                    <span className="bar"></span>
                    <span className="bar"></span>
                    <span className="bar"></span>
                </div>

                {/* --- PRAWA STRONA (Linki i Dropdown) --- */}
                <div className={`nav-right ${isMenuOpen ? 'active' : ''}`}>
                    <ul>
                        <li><NavLink to="/">{t('nav.home')}</NavLink></li>
                        <li><NavLink to="/about">{t('nav.about')}</NavLink></li>
                        <li><NavLink to="/regulations">{t('nav.regulations')}</NavLink></li>
                        <li><NavLink to="/qa">{t('nav.qa')}</NavLink></li>
                        <li><NavLink to="/staff">{t('nav.staff')}</NavLink></li>
                        <li><NavLink to="/history">{t('nav.history', 'HISTORIA')}</NavLink></li>
                        <li><NavLink to="/kos">{t('nav.kos', 'KOS')}</NavLink></li>
                        <li><NavLink to="/war-logs">{t('nav.warLogs', 'WAR LOGS')}</NavLink></li>
                        <li><NavLink to="/changelog" className="nav-changelog">{t('nav.changelog', 'CHANGELOG')}</NavLink></li>
                        {/* Logout button disabled temporarily
                        <li className="nav-logout-li">
                            <button onClick={handleLogout} className="nav-logout-btn">
                                <LogOut size={16} />
                                <span>{t('nav.logout', 'LOGOUT')}</span>
                            </button>
                        </li>
                        */}
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;