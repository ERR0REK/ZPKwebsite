// netlify/functions/kos-store.js
// Wspólna baza KOS przechowywana w Netlify Blobs (darmowy magazyn na free planie).
//
// Endpoint: /api/kos-store
//   GET    → zwraca całą listę: { ok: true, personal: [...], factions: [...] }
//   POST   → dodaje/aktualizuje cel  (tylko admin) { access_token, type, target }
//   DELETE → usuwa cel po nazwie     (tylko admin) { access_token, type, name }
//
// Weryfikacja admina: reuse verifyAdmin z ./_lib/discord (rola z Discorda przez bota).
// Dane w magazynie "zpk-kos", pod kluczem "targets", jako jeden obiekt JSON:
//   { personal: [...], factions: [...] }
//
// SEED: przy pierwszym GET (klucz nigdy nie był zapisany) baza jest zasiewana
// celami z ./_lib/kosSeed.json — kopią src/data/kosTargets.json (baza startowa
// z kodu). Dzięki temu świeże wdrożenie od razu pokazuje cele, a admini mogą
// je potem edytować. UWAGA: plik seed trzymaj w sync z src/data/kosTargets.json.
// Usunięcie WSZYSTKICH celów przez admina NIE przywraca seeda (klucz istnieje).
//
// LOKALNY DEV (netlify-cli lambda-local): poświadczenia Blobs przychodzą przez
// event.blobs (baza64 JSON z url+token, ALE bez siteID) — dodajemy mockowe
// "unlinked" (ta sama wartość, której używa netlify-cli dla sandboxa). Gdy Blobs
// w ogóle nie da się skonfigurować (MissingBlobsEnvironmentError), funkcja
// przełącza się na magazyn in-memory — lokalny dev działa end-to-end (seed,
// dodawanie, usuwanie) bez błędów. Produkcja: auto-kontekst z env, bez zmian.

const { getStore } = require("@netlify/blobs");
const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");

const STORE_NAME = "zpk-kos";
const KEY = "targets";
const MAX_TARGET_SIZE = 50 * 1024; // 50 KB na pojedynczy cel

// Kanał realtime (Ably) — powiadomienia o zmianach w liście KOS.
// Wymaga zmiennej ABLY_API_KEY (klucz ROOT) w panelu Netlify.
const ABLY_CHANNEL = "zpk-kos-updates";
const Ably = require("ably");

// Publikuje informację o zmianie na kanał Ably, żeby wszystkie otwarte
// karty /kos zaktualizowały się natychmiast (live KOS).
// Jeśli Ably nie jest skonfigurowane — cichy fallback (lista i tak działa
// przez odświeżenie / Blobs).
async function publishUpdate(type, action, targetName) {
  if (!process.env.ABLY_API_KEY) return;
  try {
    const client = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
    const channel = client.channels.get(ABLY_CHANNEL);
    await channel.publish("update", {
      type, // 'personal' | 'faction'
      action, // 'added' | 'removed'
      name: targetName,
      timestamp: Date.now()
    });
    client.close();
  } catch (err) {
    console.warn("kos-store ably publish skipped:", err.message);
  }
}

// Kontekst Blobs z eventu. Lokalny dev (netlify-cli lambda-local) przekazuje
// poświadczenia przez event.blobs (baza64 JSON) — bez siteID, więc dodajemy
// mockowe "unlinked" (wartość sandboxa netlify-cli). Produkcja: event.blobs
// nie istnieje → getStore używa auto-kontekstu ze środowiska Netlify.
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

// In-memory fallback — gdy Blobs nie da się skonfigurować (np. funkcja odpalona
// bez runtime Netlify). Dane tymczasowe (na czas życia procesu), ale lokalny
// dev działa w pełni: seed, dodawanie i usuwanie celów.
// Interfejs zgodny z @netlify/blobs v10: get(key, { type: "json" }) + setJSON.
let memoryData = null;
function createInMemoryStore() {
  return {
    get: async (_key, options) => {
      if (options && options.type === "json") return memoryData ?? null;
      return memoryData == null ? null : JSON.stringify(memoryData);
    },
    setJSON: async (_key, value) => {
      memoryData = value;
    },
  };
}

// Store rozwiązany RAZ (z pingiem) — bez powtarzania prób przy każdym requeście.
let cachedStore = null;
async function resolveStore(event) {
  if (cachedStore) return cachedStore;
  try {
    const store = getStore(STORE_NAME, getStoreOptions(event));
    // Ping — wykrywa MissingBlobsEnvironmentError (getStore rzuca synchronicznie,
    // a sieciowy błąd sandboxa dopiero przy operacji).
    await store.get(KEY, { type: "json" });
    cachedStore = store;
    return store;
  } catch (err) {
    console.warn(
      "kos-store: Netlify Blobs niedostępne — magazyn in-memory (dane tymczasowe):",
      err && err.message ? err.message : err
    );
    cachedStore = createInMemoryStore();
    return cachedStore;
  }
}

// Normalizuje obiekt celów do stabilnej struktury.
const normalizeTargets = (data) => ({
  personal: data && Array.isArray(data.personal) ? data.personal : [],
  factions: data && Array.isArray(data.factions) ? data.factions : [],
});

// Otwiera store i zwraca aktualne cele (pusta lista, jeśli nic nie zapisano).
async function getStoreAndTargets(event) {
  const store = await resolveStore(event);
  const targets = normalizeTargets(await store.get(KEY, { type: "json" }));
  return { store, targets };
}

const upsertTarget = (list, target) => [
  ...list.filter((x) => x.name !== target.name),
  target,
];

// Sanity check celu — chroni magazyn przed śmieciowymi danymi.
const isValidTarget = (target, type) => {
  if (!target || typeof target !== "object") return false;
  if (typeof target.name !== "string" || target.name.trim() === "") return false;
  if (type === "faction" && target.intel && typeof target.intel !== "object") return false;
  return true;
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    // ==================== GET (odczyt dla wszystkich) ====================
    if (event.httpMethod === "GET") {
      const store = await resolveStore(event);
      const data = await store.get(KEY, { type: "json" });
      if (data == null || typeof data !== "object") {
        // Pierwsze uruchomienie — zasiewamy bazę celami z kodu (kosSeed.json),
        // żeby świeże wdrożenie od razu pokazywało pełną listę.
        const seeded = normalizeTargets(require("./_lib/kosSeed.json"));
        await store.setJSON(KEY, seeded);
        return json(200, { ok: true, ...seeded }, {}, event);
      }
      const targets = normalizeTargets(data);
      return json(200, { ok: true, ...targets }, {}, event);
    }

    // ============ Zabezpieczenia dla POST / DELETE ============
    // Rate limit — 30 zapytań/min na IP (zmiany KOS są rzadkie)
    const rl = rateLimit(event, 30);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    // ============ POST / DELETE (tylko administratorzy) ============
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      return json(400, { ok: false, error: "BAD_JSON" }, {}, event);
    }

    const { access_token, type, name, target } = body;

    // 1. Weryfikacja roli administracyjnej
    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" }, {}, event);
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" }, {}, event);
    }

    if (type !== "personal" && type !== "faction") {
      return json(400, { ok: false, error: "BAD_TYPE" }, {}, event);
    }
    const key = type === "personal" ? "personal" : "factions";

    // 2. DELETE — usuń cel po nazwie
    if (event.httpMethod === "DELETE") {
      if (typeof name !== "string" || name.trim() === "") {
        return json(400, { ok: false, error: "MISSING_NAME" }, {}, event);
      }
      const { store, targets } = await getStoreAndTargets(event);
      targets[key] = targets[key].filter((x) => x.name !== name);
      await store.setJSON(KEY, targets);
      await publishUpdate(type, "removed", name);
      await audit("kos.remove", `${type}: ${name}`, admin.user);
      return json(200, { ok: true, ...targets }, {}, event);
    }

    // 3. POST — dodaj/aktualizuj cel
    if (event.httpMethod === "POST") {
      if (!isValidTarget(target, type)) {
        return json(400, { ok: false, error: "INVALID_TARGET" }, {}, event);
      }
      const size = Buffer.byteLength(JSON.stringify(target), "utf8");
      if (size > MAX_TARGET_SIZE) {
        return json(413, { ok: false, error: "TARGET_TOO_LARGE" }, {}, event);
      }
      const { store, targets } = await getStoreAndTargets(event);
      targets[key] = upsertTarget(targets[key], target);
      await store.setJSON(KEY, targets);
      await publishUpdate(type, "added", target.name);
      await audit("kos.add", `${type}: ${target.name}`, admin.user);
      return json(200, { ok: true, ...targets }, {}, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  } catch (err) {
    return handleError(err, "kos-store", event);
  }
};
