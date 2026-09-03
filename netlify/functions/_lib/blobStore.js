// netlify/functions/_lib/blobStore.js
//
// Wspólny adapter dla Netlify Blobs — eliminuje zduplikowany wzorzec
// getStoreOptions + createInMemoryStore + resolveStore z kos-store,
// war-store i announce.
//
// Interfejs:
//   getStoreOptions(event)          — parsuje event.blobs (dev sandbox)
//   createInMemoryStore(seedData?)  — fallback in-memory z opcjonalnym seedem
//   resolveStore(event, storeName, key, seedData?) — cache + ping + fallback
//   getStoreAndData(event, storeName, key, seedData?) — resolve + get JSON
//   defineStore({ storeName, key, seed, normalize, seedPolicy, merge }) —
//       rejestr: jedna, przetestowana polityka seedu/merge zamiast ręcznych
//       wersji w każdym handlerze
//   readStore(event, def)           — odczyt wg polityki z definicji
//
// Każdy handler importuje tylko te funkcje i dodaje własną logikę
// (normalize, Ably publish, admin verify).

const { getStore } = require("@netlify/blobs");

// Cache per storeName —每个 sklep ma swój cachedStore
const storeCache = new Map();

// ============================================================
// 1. Store options —parsuje event.blobs (netlify-cli dev sandbox)
// ============================================================
function getStoreOptions(event) {
  try {
    if (event && event.blobs) {
      const ctx = JSON.parse(Buffer.from(event.blobs, "base64").toString("utf8"));
      return {
        siteID: ctx.siteID || "unlinked",
        token: ctx.token,
        edgeURL: ctx.url_uncached || ctx.url,
        apiURL: ctx.apiURL,
      };
    }
  } catch (err) {
    /* ignore */
  }
  return {};
}

// ============================================================
// 2. In-memory fallback —gdy Blobs niedostępne (dev bez Netlify)
// ============================================================
function createInMemoryStore(seedData) {
  // Seed od razu w pamięci —local dev działa end-to-end
  let data = seedData != null ? { ...seedData } : null;
  return {
    get: async (_key, options) => {
      if (options && options.type === "json") return data ?? null;
      return data == null ? null : JSON.stringify(data);
    },
    setJSON: async (_key, value) => {
      data = value;
    },
  };
}

// ============================================================
// 3. Resolve store —cache + ping + in-memory fallback
// ============================================================
async function resolveStore(event, storeName, key, seedData) {
  const cached = storeCache.get(storeName);
  if (cached) return cached;

  try {
    const store = getStore(storeName, getStoreOptions(event));
    // Ping — wykrywa MissingBlobsEnvironmentError lub błąd sandboxa.
    // WAŻNE: cache PO pingu — jeśli ping failnie, tworzymy in-memory
    // zamiast cache'ować zepsuty store (który nigdy się nie naprawi).
    await store.get(key, { type: "json", consistency: "strong" });
    storeCache.set(storeName, store);
    return store;
  } catch (err) {
    console.warn(
      `${storeName}: Netlify Blobs niedostępne — magazyn in-memory:`,
      err && err.message ? err.message : err
    );
    const memStore = createInMemoryStore(seedData);
    storeCache.set(storeName, memStore);
    return memStore;
  }
}

// ============================================================
// 4. Get store + data —resolve + read JSON + normalize fallback
// ============================================================
async function getStoreAndData(event, storeName, key, seedData, normalizeFn) {
  const store = await resolveStore(event, storeName, key, seedData);
  const raw = await store.get(key, { type: "json", consistency: "strong" });
  const data = normalizeFn ? normalizeFn(raw) : (raw || {});
  return { store, data };
}

// ============================================================
// 5. Rejestr definicji store'ów — wspólna polityka seedu/merge
// ============================================================
// Zamiast powtarzać resolveStore + get + seed w każdym handlerze,
// store OPISUJE się definicją, a readStore wykonuje mechanikę odczytu:
//
//   const warLogs = defineStore({
//     storeName: "zpk-war-logs",
//     key: "logs",
//     seed: warSeed,
//     normalize: normalizeLogs,
//     seedPolicy: "seed-if-missing", // domyślna
//   });
//
// Polityki wypełniania:
//   "seed-if-missing" — zasiej seed tylko gdy klucz nie istnieje (i zapisz),
//   "merge-seed"      — zawsze scal seed z danymi: merge(cloud, seed) →
//                       { data, changed }; zapis tylko gdy changed,
//   "read-only"       — czysty odczyt + normalize, zero zapisów.

function defineStore({ storeName, key, seed, normalize, seedPolicy = "seed-if-missing", merge }) {
  return { storeName, key, seed, normalize, seedPolicy, merge };
}

// Odczyt wg polityki zdefiniowanej w defineStore. Zwraca { store, data }.
async function readStore(event, def) {
  const store = await resolveStore(event, def.storeName, def.key, def.seed);
  const raw = await store.get(def.key, { type: "json", consistency: "strong" });
  const cloud = def.normalize ? def.normalize(raw) : raw;

  if (def.seedPolicy === "merge-seed" && def.merge) {
    const merged = def.merge(cloud, def.seed);
    if (merged && merged.changed) {
      await store.setJSON(def.key, merged.data);
    }
    return { store, data: merged ? merged.data : cloud };
  }

  if (raw == null && def.seed != null && def.seedPolicy !== "read-only") {
    const seeded = def.normalize ? def.normalize(def.seed) : def.seed;
    await store.setJSON(def.key, seeded);
    return { store, data: seeded };
  }

  return { store, data: cloud };
}

module.exports = {
  getStoreOptions,
  createInMemoryStore,
  resolveStore,
  getStoreAndData,
  defineStore,
  readStore,
};
