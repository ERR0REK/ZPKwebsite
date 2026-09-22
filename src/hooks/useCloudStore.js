/**
 * src/hooks/useCloudStore.js
 *
 * Generyczny hook dla danych z chmury (Netlify Blobs) z fallbackiem
 * lokalnym (seed z kodu) i subskrypcją realtime (Ably).
 *
 * Rozwiązuje zduplikowany wzorzec fetch → fallback → subscribe,
 * który był powtórzony w KOS.jsx (~180 linii) i WarLogs.jsx (~120 linii).
 *
 * Użycie:
 *   const { data, cloudReady, refresh, error } = useCloudStore({
 *     endpoint: '/api/kos-store',
 *     channel: 'zpk-kos-updates',
 *     seedData: staticTargets,
 *     normalizeFn: (res) => ({ personal: res.personal, factions: res.factions }),
 *     mergeFn: (cloud, seed) => mergeTargets(cloud, seed, hiddenNames),
 *   });
 *
 * STABILNOŚĆ (ważne): seedData/normalizeFn/mergeFn są czytane przez ref,
 * NIE przez zależności useCallback. Dzięki temu rerender strony (np.
 * wpisanie znaku w wyszukiwarkę) NIE tworzy nowego fetchData i NIE
 * odpala ponownego GET-a. Wcześniej niestabilne inline-funkcje powodowały
 * burzę requestów i fałszywe przełączanie się strony w tryb lokalny.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRealtime } from '../Realtime/RealtimeProvider';

/**
 * @param {Object} options
 * @param {string}  options.endpoint   - API endpoint (GET → { ok: true, ... })
 * @param {string}  options.channel    - Ably channel name (realtime updates)
 * @param {*}       options.seedData   - Fallback data when cloud is unavailable
 * @param {Function} [options.normalizeFn] - (cloudResponse) => normalizedData
 * @param {Function} [options.mergeFn]     - (cloudData, seedData) => mergedData
 * @param {boolean}  [options.enabled]     - Hook can be disabled (default: true)
 */
const useCloudStore = ({
  endpoint,
  channel,
  seedData,
  normalizeFn,
  mergeFn,
  enabled = true,
}) => {
  const realtime = useRealtime();
  const [data, setData] = useState(seedData);
  const [cloudReady, setCloudReady] = useState(null); // null → checking, true/false → result
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const loadedOnceRef = useRef(false); // pierwszy udany GET z chmury

  // Najświeższe seedData/normalizeFn/mergeFn przez ref (pattern "latest ref").
  // Efekt bez tablicy zależności → aktualizacja po każdym renderze, ale fetchData
  // od nich NIE zależy, więc jego tożsamość (i efekty) pozostają stabilne.
  const latestRef = useRef(null);
  useEffect(() => {
    latestRef.current = {
      seedData,
      normalize: normalizeFn || ((res) => res),
      merge: mergeFn || ((cloud) => cloud),
    };
  });

  // ============================================================
  // 1. Fetch z chmury + fallback na seed (tylko przy pierwszym loadzie)
  // ============================================================
  const fetchData = useCallback(async () => {
    if (!enabled || !endpoint) return;

    const { seedData: seed, normalize, merge } = latestRef.current || {};

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (!mountedRef.current) return;
      if (!(json && json.ok)) throw new Error('bad response');

      loadedOnceRef.current = true;
      setData(merge(normalize(json), seed));
      setCloudReady(true);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;

      // Nieudane PIERWSZE pobranie → tryb lokalny (seed z kodu).
      // Nieudane odświeżenie PO udanym loadzie NIE czyści danych i NIE
      // przewraca cloudReady — jedna chwilowa awaria (rate limit, timeout,
      // restart funkcji) nie może zniszczyć stanu strony ani wymusić trybu
      // lokalnego, w którym zapisy omijają wspólną bazę.
      if (!loadedOnceRef.current) {
        setData(seed);
        setCloudReady(false);
      }
      setError(err.message || 'FETCH_FAILED');
    }
  }, [endpoint, enabled]);

  // Pierwszy fetch (fetchData jest stabilny → odpala się raz na endpoint)
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  // ============================================================
  // 2. Realtime — subskrypcja kanału Ably
  // ============================================================
  useEffect(() => {
    if (!realtime || !realtime.subscribe || !channel || !enabled) return;

    const unsubscribe = realtime.subscribe(channel, () => {
      // Po evencie odśwież dane z chmury
      fetchData();
    });

    return unsubscribe;
  }, [realtime, channel, enabled, fetchData]);

  // ============================================================
  // 3. Ręczne odświeżenie (po CRUD w panelu admina)
  // ============================================================
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, cloudReady, refresh, error };
};

export default useCloudStore;
