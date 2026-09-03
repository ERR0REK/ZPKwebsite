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

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");
const { getStoreAndData, defineStore, readStore } = require("./_lib/blobStore");
const { publish } = require("./_lib/ably");

const STORE_NAME = "zpk-war-logs";
const KEY = "logs";
const MAX_LOG_SIZE = 100 * 1024; // 100 KB na raport

// Kanał Ably — powiadomienia o zmianach w War Logs.
const ABLY_CHANNEL = "zpk-war-status";

const publishUpdate = (action, logData) =>
  publish(ABLY_CHANNEL, "update", {
    action, // 'added' | 'removed'
    name: logData?.opponent || logData?.name || "",
    title: action === "added" ? "NOWY RAPORT WOJENNY" : "USUNIĘTO RAPORT",
    message: logData?.opponent || "",
    severity: "info",
    timestamp: Date.now(),
  });

const normalizeLogs = (data) => ({
  logs: data && Array.isArray(data.logs) ? data.logs : [],
});

// Seed — dane startowe z kodu
const warSeed = normalizeLogs(require("./_lib/warSeed.json"));

// Definicja store'a (rejestr w blobStore) — polityka: zasiej tylko gdy
// klucz nigdy nie był zapisany (seed-if-missing, domyślna).
const WAR_STORE = defineStore({
  storeName: STORE_NAME,
  key: KEY,
  seed: warSeed,
  normalize: normalizeLogs,
});

async function getStoreAndLogs(event) {
  const { store, data } = await getStoreAndData(
    event, STORE_NAME, KEY, warSeed, normalizeLogs
  );
  return { store, logs: data };
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
      const { data } = await readStore(event, WAR_STORE);
      return json(200, { ok: true, ...data }, {}, event);
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
      // Porównanie po String() — klient może wysłać id jako string;
      // bez tego strict !== robił cichy no-op (usuwanie "nie działało").
      const target = logs.logs.find((l) => String(l.id) === String(id));
      if (!target) {
        return json(404, { ok: false, error: "NOT_FOUND" }, {}, event);
      }
      logs.logs = logs.logs.filter((l) => String(l.id) !== String(id));
      await store.setJSON(KEY, logs);
      await publishUpdate("removed", target);
      await audit("war.remove", `id: ${id} opponent: ${target.opponent || "?"}`, admin.user);
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
      // Upsert: jeśli log ma ID — nadpisz (String(), jak w DELETE);否则 dodaj nowy
      if (log.id) {
        logs.logs = logs.logs.filter((l) => String(l.id) !== String(log.id));
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
