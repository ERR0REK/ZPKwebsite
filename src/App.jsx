import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import SecurityLayer from './Components/Security/SecurityLayer';
import AuthGuard from './Components/Auth/AuthGuard';
import { SessionProvider, useSession } from './Context/SessionContext';
import DiscordCallback from './Components/Auth/DiscordCallback';
import ScrollToTop from './Components/Shared/ScrollToTop';
import BackToTop from './Components/Shared/BackToTop';
import PrivacyToast from './Components/Shared/PrivacyToast';
import './Components/Shared/PrivacyToast.css';
import LoadingScreen from '../src/Components/LoadingScreen/LoadingScreen';
import SpaceBackground from './Components/Shared/SpaceBackground';
import { RealtimeProvider } from './Realtime/RealtimeProvider';
import { isDevSite } from './utils/siteEnv';
import './Components/Shared/DevBanner.css';

// ============================================================
// LAZY-LOADING — każda strona ładuje się dopiero, gdy jest
// potrzebna (code-splitting). Dzięki temu start strony jest
// szybszy: bundle główny nie zawiera wszystkich 11 podstron.
// ============================================================
const Home = lazy(() =>
  import('./Components/Pages/Home').then((m) => ({ default: m.Home }))
);
const About = lazy(() => import('./Components/Pages/About'));
const Regulations = lazy(() => import('./Components/Pages/Regulations'));
const Qa = lazy(() => import('./Components/Pages/QA'));
const Staff = lazy(() => import('./Components/Pages/Staff'));
const Changelog = lazy(() => import('./Components/Pages/Changelog'));
const WarLogs = lazy(() => import('./Components/WarLogs/WarLogs'));
const History = lazy(() => import('./Components/Pages/History'));
const KOS = lazy(() => import('./Components/Pages/KOS'));
const NotFound = lazy(() => import('./Components/Pages/NotFound'));
const Terms = lazy(() => import('./Components/Pages/Legal'));
const Privacy = lazy(() => import('./Components/Pages/Privacy'));

// Baner DEV BUILD — auto-chowa się po 5s, zostaje mały badge "DEV".
// Kliknięcie badge'a przywraca pełny baner na 3s.
const DevBanner = () => {
  const [phase, setPhase] = useState('full'); // full → collapsing → badge → full → ...

  // Toggle klasy na body — Navbar przesuwa się w dół gdy baner widoczny
  useEffect(() => {
    if (phase === 'full' || phase === 'collapsing') {
      document.body.classList.add('dev-banner-active');
    } else {
      document.body.classList.remove('dev-banner-active');
    }
    return () => document.body.classList.remove('dev-banner-active');
  }, [phase]);

  useEffect(() => {
    if (phase !== 'full') return;
    const t = setTimeout(() => setPhase('collapsing'), 5000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'collapsing') return;
    const t = setTimeout(() => setPhase('badge'), 400);
    return () => clearTimeout(t);
  }, [phase]);

  const handleBadgeClick = () => {
    setPhase('full');
  };

  return (
    <>
      {phase === 'full' && (
        <div className="dev-banner-full">
          <span>⚠ DEV BUILD — TYLKO DLA CZŁONKÓW SERWERA DEWELOPERSKIEGO ⚠</span>
        </div>
      )}
      {phase === 'collapsing' && (
        <div className="dev-banner-full collapsing">
          <span>⚠ DEV BUILD — TYLKO DLA CZŁONKÓW SERWERA DEWELOPERSKIEGO ⚠</span>
        </div>
      )}
      {phase === 'badge' && (
        <div className="dev-badge visible" onClick={handleBadgeClick} title="DEV BUILD">
          DEV
        </div>
      )}
    </>
  );
};

// Lekki fallback podczas ładowania leniwej strony.
const RouteFallback = () => (
  <div className="route-fallback">
    <div className="route-fallback-spinner"></div>
  </div>
);

// LoginPage ładowany leniwie — na produkcji nie jest potrzebny (brak DevGuard).
// WAŻNE: React.lazy MUSI być na poziomie modułu (nie wewnątrz komponentu),
// bo wywołanie go wewnątrz render() tworzy nowy lazy component przy każdym
  // renderze → nowy fetch → wieczny Suspense spinner (bug na dev-zpkwebsite).
const LazyLoginPage = React.lazy(() => import('./Components/Auth/LoginPage'));

// DevGuard — bramka strony dev (dostęp tylko z sesją is_dev_member).
// Upraszcza logikę: sprawdza sesję z localStorage i renderuje LoginPage
// lub children, bez zagnieżdżania Routes (React Router v7 compatibility).
const DevGuard = ({ children }) => {
  // Sesja pochodzi z SessionProvider — jest tam już zwalidowana pod kątem
  // TTL 12h (przeterminowana = null), więc na stronie dev wygasła sesja
  // automatycznie wyświetli LoginPage, zamiast wpuszczać jak wcześniej.
  const { session } = useSession();
  const [loadError, setLoadError] = useState(false);

  // allowed jest synchronczne (nie null) — kontekst zwraca gotową wartość.
  const allowed = !!(session && session.user_id && session.is_dev_member === true);

  // Timeout-fallback: jeśli lazy load trwa dłużej niż 5s, pokaż komunikat
  // zamiast wiecznego spinera (regexa Netlify / CSP / brak chunka).
  useEffect(() => {
    if (allowed) return;
    const t = setTimeout(() => setLoadError(true), 5000);
    return () => clearTimeout(t);
  }, [allowed]);

  if (!allowed) {
    if (loadError) {
      return (
        <div className="route-fallback" style={{ flexDirection: 'column', gap: '20px' }}>
          <div className="route-fallback-spinner"></div>
          <p style={{ color: '#ef4444', fontFamily: 'Share Tech Mono', fontSize: '0.85rem', letterSpacing: '2px' }}>
            DEV_ACCESS_REQUIRED
          </p>
          <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            Zaloguj się przez Discord z dostępem do serwera deweloperskiego.
          </p>
        </div>
      );
    }
    return (
      <Suspense fallback={<RouteFallback />}>
        <LazyLoginPage devMode />
      </Suspense>
    );
  }

  return children;
};

// ============================================================
// Trasy dla strony produkcyjnej (devSite = false)
// Wszystkie trasy są PŁASKIE — zero zagnieżdżonych Routes.
// KOS i WarLogs chronione AuthGuard, reszta publiczna.
// ============================================================
const ProdRoutes = () => (
  <Routes>
    <Route path="/auth/callback" element={<DiscordCallback />} />
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/regulations" element={<Regulations />} />
    <Route path="/qa" element={<Qa />} />
    <Route path="/history" element={<History />} />
    <Route path="/changelog" element={<Changelog />} />
    <Route path="/staff" element={<Staff />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/kos" element={<AuthGuard><KOS /></AuthGuard>} />
    <Route path="/war-logs" element={<AuthGuard><WarLogs /></AuthGuard>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

// ============================================================
// Trasy dla strony deweloperskiej (devSite = true)
// Cała strona za DevGuard — dostępny tylko z sesją dev.
// ============================================================
const DevRoutes = () => (
  <DevGuard>
    <Routes>
      <Route path="/auth/callback" element={<DiscordCallback />} />
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/regulations" element={<Regulations />} />
      <Route path="/qa" element={<Qa />} />
      <Route path="/history" element={<History />} />
      <Route path="/changelog" element={<Changelog />} />
      <Route path="/staff" element={<Staff />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/kos" element={<KOS />} />
      <Route path="/war-logs" element={<WarLogs />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </DevGuard>
);

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // DiscordCallback nie używa react-router — renderujemy go bezpośrednio.
  if (window.location.hash.includes('access_token=')) {
    return <DiscordCallback />;
  }

  const devSite = isDevSite();

  return (
    <RealtimeProvider>
      <SessionProvider>
        <SpaceBackground />
        <SecurityLayer />
        <PrivacyToast />
        {devSite && <DevBanner />}
        <Router>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            {devSite ? <DevRoutes /> : <ProdRoutes />}
          </Suspense>
          <BackToTop />
        </Router>
      </SessionProvider>
    </RealtimeProvider>
  );
}

export default App;
