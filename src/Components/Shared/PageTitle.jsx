// src/Components/Shared/PageTitle.jsx
// Tytuł karty przeglądarki per podstrona (np. "KOS — ZPK").
// Bez tego każda zakładka nazywa się tak samo i nie da się ich odróżnić.
// Renderuje null — czysty efekt uboczny pod routera.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/* Trasa -> polska nazwa podstrony. Znak "—" i skrót ZPK dopina wspólny suffix. */
const TITLES = {
  '/': 'Strona główna',
  '/about': 'Czym jest ZPK',
  '/regulations': 'Regulamin',
  '/qa': 'FAQ',
  '/history': 'Historia',
  '/changelog': 'Changelog',
  '/staff': 'Kadra',
  '/terms': 'Regulamin serwisu',
  '/privacy': 'Polityka prywatności',
  '/kos': 'KOS',
  '/war-logs': 'War Logs',
};

const SUFFIX = ' — ZPK';

const PageTitle = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const base = TITLES[pathname];
    document.title = base
      ? `${base}${SUFFIX}`
      : 'Zjednoczona Polska Korona';
  }, [pathname]);

  return null;
};

export default PageTitle;
