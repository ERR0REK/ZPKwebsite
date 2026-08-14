import React, { useState, useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import SecurityLayer from './Components/Security/SecurityLayer';
import AuthGuard from './Components/Auth/AuthGuard';
import DiscordCallback from './Components/Auth/DiscordCallback';
import DevGuard from './Components/Auth/DevGuard';
import ScrollToTop from './Components/Shared/ScrollToTop';
import BackToTop from './Components/Shared/BackToTop';
import LoadingScreen from '../src/Components/LoadingScreen/LoadingScreen';
import SpaceBackground from './Components/Shared/SpaceBackground';
import { RealtimeProvider } from './Realtime/RealtimeProvider';
import { isDevSite } from './utils/siteEnv';

// ============================================================
// LAZY-LOADING — każda strona ładuje się dopiero, gdy jest
// potrzebna (code-splitting). Dzięki temu start strony jest
// szybszy: bundle główny nie zawiera wszystkich 11 podstron.
// ============================================================
const Home = lazy(() =>
  import('../src/Components/Pages/Home').then((m) => ({ default: m.Home }))
);
const About = lazy(() => import('../src/Components/Pages/About'));
const Regulations = lazy(() => import('../src/Components/Pages/Regulations'));
const Qa = lazy(() => import('./Components/Pages/QA'));
const Staff = lazy(() => import('../src/Components/Pages/Staff'));
const Changelog = lazy(() => import('../src/Components/Pages/Changelog'));
const WarLogs = lazy(() => import('./Components/WarLogs/WarLogs'));
const History = lazy(() => import('./Components/Pages/History'));
const KOS = lazy(() => import('./Components/Pages/KOS'));
const NotFound = lazy(() => import('./Components/Pages/NotFound'));
const Terms = lazy(() => import('./Components/Pages/Legal'));
const Privacy = lazy(() => import('./Components/Pages/Privacy'));

// Baner DEV BUILD — widoczny tylko na domenie deweloperskiej
const DevBanner = () => (
  <div className="dev-banner">
    <span>⚠ DEV BUILD — TYLKO DLA CZŁONKÓW SERWERA DEWELOPERSKIEGO ⚠</span>
  </div>
);

// Lekki fallback podczas ładowania leniwej strony (zamiast pełnego
// LoadingScreen — ten odpala się tylko raz przy starcie aplikacji).
const RouteFallback = () => (
  <div className="route-fallback">
    <div className="route-fallback-spinner"></div>
  </div>
);

// Wszystkie trasy + animacja przejścia między stronami.
// Klucz motion.div = ścieżka — AnimatePresence odgrywa fade na
// wyjściu i wejściu, dając płynną zmianę podstrony.
const AnimatedRoutes = () => {
  const location = useLocation();
  const devSite = isDevSite();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="route-anim-wrapper"
      >
        <ScrollToTop />
        <Routes location={location}>
          <Route path="/auth/callback" element={<DiscordCallback />} />

          {devSite ? (
            <Route
              path="*"
              element={
                <DevGuard>
                  <Routes>
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
              }
            />
          ) : (
            <>
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
            </>
          )}
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

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

  // DiscordCallback nie używa react-router (przekierowuje przez window.location),
  // więc renderujemy go bezpośrednio — poprzedni <Route path="/*"> łapał WSZYSTKIE
  // ścieżki i po zalogowaniu powodował ponowny mount callbacku bez tokena
  // (błąd NO_TOKEN_RECEIVED). Po udanym logowaniu DiscordCallback robi pełne
  // odświeżenie strony z czystym URL, więc App wraca do głównego routera.
  if (window.location.hash.includes('access_token=')) {
    return <DiscordCallback />;
  }

  const devSite = isDevSite();

  return (
    <RealtimeProvider>
      <SpaceBackground />
      <SecurityLayer />
      {devSite && <DevBanner />}
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <AnimatedRoutes />
        </Suspense>
        <BackToTop />
      </Router>
    </RealtimeProvider>
  );
}

export default App;
