// netlify/functions/_lib/blobStore.js
//
// Wspólny adapter dla Netlify Blobs — eliminuje zduplikowany wzorzec
// getStoreOptions + createInMemoryStore + resolveStore z kos-store,
// war-store i announce.
//
// Dwa style przechowywania:
//
// 1) Pojedynczy klucz (stary, nadal używany przez announce/announce-history):
//      getStoreAndData / defineStore / readStore
//
// 2) Jeden wpis = jeden blob (kos-store, war-store):
//      readEntryStore({ storeName, prefix, legacyKey, seed, toEntries })
//    - każdy cel/raport ma własny klucz (targets/personal/<nazwa>,
//      logs/<id>) i własny ETag — mutacje są atomiczne (onlyIfMatch /
//      onlyIfNew), koniec z last-write-wins przy dwóch adminach naraz,
//    - migracja legacy: stary pojedynczy klucz jest rozbijany na wpisy
//      i usuwany (idempotentnie — tylkoIfNew chroni przed duplikatami),
//    - seed: wpisy startowe trafiają do magazynu TYLKO przy pierwszym
//      uruchomieniu (marker "_meta/seeded") — dzięki temu skasowany cel
//      NIE wraca po odświeżeniu (stary merge-seed to przywracał).
//
// Store'y otwierane z consistency: "strong" na poziomie store'a — obejmuje
// też list(), więc wpisy po mutacji są widoczne od razu (bez tego list()
// bywa eventual-consistent i potrafi pokazywać stare dane do 60 s).

const { getStore } = require("@netlify/blobs");

// Cache per storeName — każdy sklep ma swój cachedStore
const storeCache = new Map();

// Klucz markera "store był już zasiany" — gwarantuje, że seed wejdzie
// tylko raz (skasowane wpisy nie wracają).
const SEED_MARKER = "_meta/seeded";

// ============================================================
// 1. Store options — parsuje event.blobs (netlify-cli dev sandbox)
// ============================================================
function getStoreOptions(event) {
  try {
    if (event && event.blobs) {
      const ctx = JSON.parse(Buffer.from(event.blobs, "base64").toString("utf8"));
      return {
        siteID: ctx.siteID || "unlinked",
        token: ctx.token,
        edgeURL: ctx.url,
        uncachedEdgeURL: ctx.url_uncached,
        apiURL: ctx.apiURL,
      };
    }
  } catch (err) {
    /* ignore */
  }
  return {};
}

// ============================================================
// 2. In-memory fallback — gdy Blobs niedostępne (dev bez Netlify)
// ============================================================
// Emuluje interfejs store'a Netlify Blobs (get / getWithMetadata /
// getMetadata / set / setJSON / delete / list) z ETagami i warunkami
// onlyIfMatch / onlyIfNew — lokalny dev działa end-to-end i zachowuje
// się jak prawdziwy magazyn (ten sam kod testuje adapter).
function createInMemoryStore() {
  const map = new Map(); // key → { value: string, etag }
  let etagCounter = 0;
  const nextEtag = () => `"mem-${++etagCounter}"`;
  return {
    async get(key, options) {
      const entry = map.get(key);
      if (!entry) return null;
      const raw = entry.value;
      return options && options.type === "json" ? JSON.parse(raw) : raw;
    },
    async getWithMetadata(key, options) {
      const entry = map.get(key);
      if (!entry) return null;
      let data = entry.value;
      if (options && options.type === "json") data = JSON.parse(data);
      return { data, etag: entry.etag, metadata: {} };
    },
    async getMetadata(key) {
      const entry = map.get(key);
      if (!entry) return null;
      return { etag: entry.etag, metadata: {} };
    },
    async set(key, value, options = {}) {
      const existing = map.get(key);
      if (options.onlyIfNew && existing) return { modified: false };
      if (options.onlyIfMatch) {
        if (!existing || existing.etag !== options.onlyIfMatch) {
          return { modified: false };
        }
      }
      const etag = nextEtag();
      map.set(key, { value: String(value), etag });
      return { modified: true, etag };
    },
    async setJSON(key, value, options = {}) {
      return this.set(key, JSON.stringify(value), options);
    },
    async delete(key) {
      map.delete(key);
    },
    async list({ prefix = "" } = {}) {
      const blobs = [];
      for (const [key, entry] of map) {
        if (key.startsWith(prefix)) blobs.push({ key, etag: entry.etag });
      }
      return { blobs, directories: [] };
    },
  };
}

// ============================================================
// 3. Resolve store — cache + ping + in-memory fallback
// ============================================================
// Store otwierany z consistency: "strong" — silna spójność obejmuje
// wszystkie operacje, w tym list() (który nie ma własnej opcji).
async function resolveStore(event, storeName, key, seedData) {
  const cached = storeCache.get(storeName);
  if (cached) return cached;

  try {
    const store = getStore(storeName, { ...getStoreOptions(event), consistency: "strong" });
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
    const memStore = createInMemoryStore();
    storeCache.set(storeName, memStore);
    return memStore;
  }
}

// ============================================================
// 4. Get store + data — resolve + read JSON + normalize fallback
// ============================================================
// Stary styl (pojedynczy klucz) — nadal używany przez announce-history.
async function getStoreAndData(event, storeName, key, seedData, normalizeFn) {
  const store = await resolveStore(event, storeName, key, seedData);
  const raw = await store.get(key, { type: "json", consistency: "strong" });
  const data = normalizeFn ? normalizeFn(raw) : (raw || {});
  return { store, data };
}

// ============================================================
// 5. Rejestr definicji store'ów (pojedynczy klucz) — readStore
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

// ============================================================
// 6. Entry-based storage — jeden wpis = jeden blob
// ============================================================
// Lista → zbiór blobów pod wspólnym prefiksem (np. "logs/", "targets/").
// Zamiast read-modify-write całej tablicy (last-write-wins przy dwóch
// adminach), każdy wpis ma własny klucz i własny ETag:
//   - listEntries(store, prefix)          → klucze pod prefiksem
//   - readEntry(store, key)               → { data, etag } | null
//   - writeEntry(store, key, data, opts?) → { modified, etag }
//                                         (opts: onlyIfMatch | onlyIfNew)
//   - removeEntry(store, key)             → usunięcie wpisu
//   - readEntryStore(event, def)          → migracja + seed + odczyt wpisów

async function listEntries(store, prefix) {
  const { blobs } = await store.list({ prefix });
  return blobs.map((b) => b.key);
}

async function readEntry(store, key) {
  const entry = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
  if (entry === null) return null;
  return { data: entry.data, etag: entry.etag };
}

async function writeEntry(store, key, data, opts = {}) {
  const options = {};
  if (opts.onlyIfMatch) options.onlyIfMatch = opts.onlyIfMatch;
  if (opts.onlyIfNew) options.onlyIfNew = true;
  return store.setJSON(key, data, options);
}

async function removeEntry(store, key) {
  await store.delete(key);
}

// Główny odczyt entry-store'a. Definicja (def):
//   storeName  — nazwa store'a Netlify Blobs
//   prefix     — prefiks wpisów, np. "targets/" | "logs/"
//   legacyKey  — klucz starego pojedynczego wpisu (do migracji), opcjonalny
//   seed       — dane startowe (ta sama struktura co legacyKey), opcjonalne
//   toEntries  — (doc) → [{ key, data }]; wspólne dla migracji i seedu
//
// Kolejność:
//   1. Migracja legacy → wpisy (idempotentna, tylkoIfNew) + ustaw marker,
//      żeby seed nie przywracał celów skasowanych przed migracją.
//   2. Seed — tylko gdy marker jeszcze nie istnieje (seed-once).
//   3. Odczyt wszystkich wpisów (strong per-key).
async function readEntryStore(event, def) {
  const { storeName, prefix, legacyKey, seed, toEntries } = def;
  const store = await resolveStore(event, storeName, legacyKey || prefix, seed);

  // 1. Migracja: stary pojedynczy klucz → wpisy
  if (legacyKey) {
    const raw = await store.get(legacyKey, { type: "json", consistency: "strong" });
    if (raw != null) {
      for (const e of toEntries(raw)) {
        await writeEntry(store, e.key, e.data, { onlyIfNew: true });
      }
      await store.delete(legacyKey);
      await writeEntry(store, SEED_MARKER, { at: new Date().toISOString() }, { onlyIfNew: true });
    }
  }

  // 2. Odczyt kluczy pod prefiksem (store-level strong obejmuje list)
  let keys = await listEntries(store, prefix);

  // 3. Seed-once: wpisy startowe tylko przy pierwszym uruchomieniu
  if (seed) {
    const marker = await store.getMetadata(SEED_MARKER, { consistency: "strong" });
    if (!marker) {
      const present = new Set(keys);
      const missing = toEntries(seed).filter((e) => !present.has(e.key));
      if (missing.length > 0) {
        for (const e of missing) {
          await writeEntry(store, e.key, e.data, { onlyIfNew: true });
        }
        keys = await listEntries(store, prefix);
      }
      await writeEntry(store, SEED_MARKER, { at: new Date().toISOString() }, { onlyIfNew: true });
    }
  }

  // 4. Odczyt wpisów
  const entries = [];
  for (const key of keys) {
    const entry = await readEntry(store, key);
    if (entry) entries.push({ key, data: entry.data, etag: entry.etag });
  }
  return { store, entries };
}

module.exports = {
  getStoreOptions,
  createInMemoryStore,
  resolveStore,
  getStoreAndData,
  defineStore,
  readStore,
  listEntries,
  readEntry,
  writeEntry,
  removeEntry,
  readEntryStore,
};