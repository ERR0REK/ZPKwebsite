// netlify/functions/war-store.js
// Wspólna baza War Logs przechowywana w Netlify Blobs.
//
// Endpoint: /api/war-store
//   GET    → zwraca listę: { ok: true, logs: [...] }
//   POST   → dodaje raport wojenny (tylko admin) { access_token, log }
//   DELETE → usuwa raport po ID (tylko admin) { access_token, id }
//
// STORAGE (redesign: jeden wpis = jeden blob):
//   Każdy raport to osobny blob w store "zpk-war-logs": logs/<id>
//   Mutacje są atomiczne (onlyIfMatch / onlyIfNew na ETagu wpisu) — dwóch
//   adminów naraz nie gubi sobie nawzajem raportów (last-write-wins).
//
// MIGRACJA: stary pojedynczy klucz "logs" ({ logs: [...] } w jednym JSON)
// jest przy pierwszym GET rozbijany na wpisy i usuwany (idempotentnie).
//
// SEED: warSeed.json jest pusty ({ logs: [] }) — seed nie ma realnego
// zastosowania, ale ścieżka pozostaje spójna z rejestrem.
//
// LIVE: po każdej zmianie publikuje event na kanale Ably "zpk-war-status",
// żeby strona główna (ActivityFeed) i WarLogs pokazywały zmiany natychmiast.
//
// LOKALNY DEV: fallback in-memory (dane tymczasowe) gdy Blobs niedostępne.

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");
const {
  resolveStore,
  readEntryStore,
  readEntry,
  writeEntry,
  removeEntry,
} = require("./_lib/blobStore");
const { publish } = require("./_lib/ably");

const STORE_NAME = "zpk-war-logs";
const LEGACY_KEY = "logs"; // stary pojedynczy klucz (migracja)
const PREFIX = "logs/"; // prefiks wpisów
const MAX_LOG_SIZE = 100 * 1024; // 100 KB na raport
const MAX_ID_ATTEMPTS = 5;

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

// Seed — dane startowe z kodu (puste — raporty tworzą admini)
const warSeed = require("./_lib/warSeed.json");

// Wspólne mapowanie dokumentu { logs: [...] } → wpisy.
// Używane zarówno przez migrację legacy, jak i seed.
const warToEntries = (doc) =>
  (doc && Array.isArray(doc.logs) ? doc.logs : []).map((l) => ({
    key: `${PREFIX}${l.id}`,
    data: l,
  }));

// Definicja entry-store'a War Logs (rejestr w blobStore)
const WAR_ENTRIES = {
  storeName: STORE_NAME,
  prefix: PREFIX,
  legacyKey: LEGACY_KEY,
  seed: warSeed,
  toEntries: warToEntries,
};

// Sortowanie jak na froncie: date desc, potem id desc (tie-break).
const sortLogs = (logs) =>
  [...logs].sort((a, b) => {
    const da = String(a.date || "");
    const db = String(b.date || "");
    if (da !== db) return db.localeCompare(da);
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });

// Sanity check raportu
const isValidLog = (log) => {
  if (!log || typeof log !== "object") return false;
  if (typeof log.opponent !== "string" || log.opponent.trim() === "") return false;
  return true;
};

// Generuj ID na podstawie timestampu (kolizje w tej samej ms rozwiązuje
// pętla z onlyIfNew w POST)
const generateId = () => Date.now();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    // ==================== GET ====================
    if (event.httpMethod === "GET") {
      const { entries } = await readEntryStore(event, WAR_ENTRIES);
      const logs = sortLogs(entries.map((e) => e.data));
      return json(200, { ok: true, logs }, {}, event);
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
      const store = await resolveStore(event, STORE_NAME, LEGACY_KEY, warSeed);
      const key = `${PREFIX}${id}`;
      const existing = await readEntry(store, key);
      if (!existing) {
        return json(404, { ok: false, error: "NOT_FOUND" }, {}, event);
      }
      await removeEntry(store, key);
      await publishUpdate("removed", existing.data);
      await audit("war.remove", `id: ${id} opponent: ${existing.data.opponent || "?"}`, admin.user);

      // Świeży snapshot — odfiltruj skasowany wpis (list może go jeszcze
      // pokazywać przez chwilę przy eventual consistency edge'ów).
      const { entries } = await readEntryStore(event, WAR_ENTRIES);
      const logs = sortLogs(
        entries.filter((e) => e.key !== key).map((e) => e.data)
      );
      return json(200, { ok: true, logs }, {}, event);
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
      const store = await resolveStore(event, STORE_NAME, LEGACY_KEY, warSeed);

      let id = log.id;
      let key;

      if (id == null) {
        // Nowy raport — wygeneruj unikalne id i zapisz atomowo (onlyIfNew).
        // Kolizja w tej samej ms (druga instancja) → retry z nowym id.
        let res = { modified: false };
        for (let attempt = 0; attempt < MAX_ID_ATTEMPTS && !res.modified; attempt += 1) {
          id = generateId();
          key = `${PREFIX}${id}`;
          res = await writeEntry(store, key, { ...log, id }, { onlyIfNew: true });
        }
        if (!res.modified) {
          return json(409, { ok: false, error: "CONFLICT" }, {}, event);
        }
      } else {
        // Upsert po id — atomiczny: nowy → onlyIfNew, istniejący → onlyIfMatch.
        key = `${PREFIX}${id}`;
        let res = await writeEntry(store, key, log, { onlyIfNew: true });
        if (!res.modified) {
          const existing = await readEntry(store, key);
          if (existing) {
            res = await writeEntry(store, key, log, { onlyIfMatch: existing.etag });
          } else {
            res = await writeEntry(store, key, log, { onlyIfNew: true });
          }
        }
        if (!res.modified) {
          return json(409, { ok: false, error: "CONFLICT" }, {}, event);
        }
      }

      await publishUpdate("added", { ...log, id });
      await audit("war.add", `opponent: ${log.opponent} id: ${id}`, admin.user);

      const { entries } = await readEntryStore(event, WAR_ENTRIES);
      const logs = sortLogs(entries.map((e) => e.data));
      return json(200, { ok: true, logs }, {}, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  } catch (err) {
    return handleError(err, "war-store", event);
  }
};