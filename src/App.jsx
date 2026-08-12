import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import { Home } from '../src/Components/Pages/Home';
import About from '../src/Components/Pages/About';
import Regulations from '../src/Components/Pages/Regulations';
import Qa from './Components/Pages/QA';
import Staff from '../src/Components/Pages/Staff';
import Changelog from '../src/Components/Pages/Changelog';
import WarLogs from './Components/WarLogs/WarLogs';
import SecurityLayer from './Components/Security/SecurityLayer';
import AuthGuard from './Components/Auth/AuthGuard';
import DiscordCallback from './Components/Auth/DiscordCallback';
import History from './Components/Pages/History';
import KOS from './Components/Pages/KOS';
import NotFound from './Components/Pages/NotFound';

import LoadingScreen from '../src/Components/LoadingScreen/LoadingScreen';
import SpaceBackground from './Components/Shared/SpaceBackground';
import { RealtimeProvider } from './Realtime/RealtimeProvider';

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

  if (window.location.hash.includes('access_token=')) {
    return (
      <Router>
        <Routes>
          <Route path="/*" element={<DiscordCallback />} />
        </Routes>
      </Router>
    );
  }

  return (
    <RealtimeProvider>
      <SpaceBackground />
      <SecurityLayer />
      <Router>
        <Routes>
          <Route path="/auth/callback" element={<DiscordCallback />} />

          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/regulations" element={<Regulations />} />
          <Route path="/qa" element={<Qa />} />
          <Route path="/history" element={<History />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/staff" element={<Staff />} />

          <Route path="/kos" element={<AuthGuard><KOS /></AuthGuard>} />
          <Route path="/war-logs" element={<AuthGuard><WarLogs /></AuthGuard>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </RealtimeProvider>
  );
}

export default App;
