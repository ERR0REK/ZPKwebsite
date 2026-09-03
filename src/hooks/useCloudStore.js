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
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

  // Default: identity (no transformation) — stable via useMemo
  const normalize = useMemo(() => normalizeFn || ((res) => res), [normalizeFn]);
  // Default: no merge (use cloud data as-is) — stable via useMemo
  const merge = useMemo(() => mergeFn || ((cloud) => cloud), [mergeFn]);

  // ============================================================
  // 1. Fetch z chmury + fallback na seed
  // ============================================================
  const fetchData = useCallback(async () => {
    if (!enabled || !endpoint) return;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (!mountedRef.current) return;

      if (json && json.ok) {
        const normalized = normalize(json);
        setData(merge(normalized, seedData));
        setCloudReady(true);
        setError(null);
      } else {
        throw new Error('bad response');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      // Fallback — dane z seeda (z kodu)
      setData(seedData);
      setCloudReady(false);
      setError(err.message || 'FETCH_FAILED');
    }
  }, [endpoint, seedData, normalize, merge, enabled]);

  // Pierwszy fetch
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
