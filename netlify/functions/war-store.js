// netlify/functions/war-store.js
// Wspólna baza War Logs przechowywana w Netlify Blobs.
//
// Endpoint: /api/war-store
//   GET    → zwraca listę: { ok: true, logs: [...] }
//   POST   → dodaje raport wojenny (tylko admin) { access_token, log }
//   DELETE → usuwa raport po ID (tylko admin) { access_token, id }
//
// SEED: przy pierwszym GET klucz nigdy nie był zapisany → baza jest zasiewana
// danymi z ./_lib/warSeed.json (kopia src/data/warLogs.json).
//
// LIVE: po każdej zmianie publikuje event na kanale Ably "zpk-war-status",
// żeby strona główna (ActivityFeed) i WarLogs pokazywały zmiany natychmiast.
//
// LOKALNY DEV: fallback in-memory (dane tymczasowe) gdy Blobs niedostępne.

const { getStore } = require("@netlify/blobs");
const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");

const STORE_NAME = "zpk-war-logs";
const KEY = "logs";
const MAX_LOG_SIZE = 100 * 1024; // 100 KB na raport

// Kanał Ably — powiadomienia o zmianach w War Logs.
const ABLY_CHANNEL = "zpk-war-status";
const Ably = require("ably");

async function publishUpdate(action, logData) {
  if (!process.env.ABLY_API_KEY) return;
  try {
    const client = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
    const channel = client.channels.get(ABLY_CHANNEL);
    await channel.publish("update", {
      action, // 'added' | 'removed'
      name: logData?.opponent || logData?.name || "",
      title: action === "added" ? "NOWY RAPORT WOJENNY" : "USUNIĘTO RAPORT",
      message: logData?.opponent || "",
      severity: "info",
      timestamp: Date.now(),
    });
    client.close();
  } catch (err) {
    console.warn("war-store ably publish skipped:", err.message);
  }
}

// Store options — patrz kos-store.js
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

// In-memory fallback
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

let cachedStore = null;
async function resolveStore(event) {
  if (cachedStore) return cachedStore;
  try {
    const store = getStore(STORE_NAME, getStoreOptions(event));
    await store.get(KEY, { type: "json" });
    cachedStore = store;
    return store;
  } catch (err) {
    console.warn(
      "war-store: Netlify Blobs niedostępne — magazyn in-memory:",
      err && err.message ? err.message : err
    );
    cachedStore = createInMemoryStore();
    return cachedStore;
  }
}

const normalizeLogs = (data) => ({
  logs: data && Array.isArray(data.logs) ? data.logs : [],
});

async function getStoreAndLogs(event) {
  const store = await resolveStore(event);
  const data = await store.get(KEY, { type: "json" });
  return { store, logs: normalizeLogs(data) };
}

// Sanity check raportu
const isValidLog = (log) => {
  if (!log || typeof log !== "object") return false;
  if (typeof log.opponent !== "string" || log.opponent.trim() === "") return false;
  return true;
};

// Generuj ID na podstawie timestampu
const generateId = () => Date.now();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    // ==================== GET ====================
    if (event.httpMethod === "GET") {
      const store = await resolveStore(event);
      const data = await store.get(KEY, { type: "json" });
      if (data == null || typeof data !== "object") {
        const seeded = normalizeLogs(require("./_lib/warSeed.json"));
        await store.setJSON(KEY, seeded);
        return json(200, { ok: true, ...seeded }, {}, event);
      }
      return json(200, { ok: true, ...normalizeLogs(data) }, {}, event);
    }

    // ============ POST / DELETE — admin only ============
    const rl = rateLimit(event, 30);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      return json(400, { ok: false, error: "BAD_JSON" }, {}, event);
    }

    const { access_token, log, id } = body;

    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" }, {}, event);
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" }, {}, event);
    }

    // ==================== DELETE ====================
    if (event.httpMethod === "DELETE") {
      if (id == null) {
        return json(400, { ok: false, error: "MISSING_ID" }, {}, event);
      }
      const { store, logs } = await getStoreAndLogs(event);
      const target = logs.logs.find((l) => l.id === id);
      logs.logs = logs.logs.filter((l) => l.id !== id);
      await store.setJSON(KEY, logs);
      await publishUpdate("removed", target);
      await audit("war.remove", `id: ${id} opponent: ${target?.opponent || "?"}`, admin.user);
      return json(200, { ok: true, ...logs }, {}, event);
    }

    // ==================== POST ====================
    if (event.httpMethod === "POST") {
      if (!isValidLog(log)) {
        return json(400, { ok: false, error: "INVALID_LOG" }, {}, event);
      }
      const size = Buffer.byteLength(JSON.stringify(log), "utf8");
      if (size > MAX_LOG_SIZE) {
        return json(413, { ok: false, error: "LOG_TOO_LARGE" }, {}, event);
      }
      const { store, logs } = await getStoreAndLogs(event);
      // Upsert: jeśli log ma ID — nadpisz;否则 dodaj nowy
      if (log.id) {
        logs.logs = logs.logs.filter((l) => l.id !== log.id);
      } else {
        log.id = generateId();
      }
      logs.logs.push(log);
      await store.setJSON(KEY, logs);
      await publishUpdate("added", log);
      await audit("war.add", `opponent: ${log.opponent} id: ${log.id}`, admin.user);
      return json(200, { ok: true, ...logs }, {}, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  } catch (err) {
    return handleError(err, "war-store", event);
  }
};
