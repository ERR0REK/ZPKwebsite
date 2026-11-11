// netlify/functions/kos-activity.js
// Log aktywności KOS — kto, co, kiedy dodał/usunął cel.
// Przechowywane w Netlify Blobs (store: zpk-kos-activity).
// Używa entry-based storage (jeden wpis = jeden blob) jak kos-store.

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, handleError } = require("./_lib/security");
const {
  resolveStore,
  readEntryStore,
  writeEntry,
  listEntries,
} = require("./_lib/blobStore");

const STORE_NAME = "zpk-kos-activity";
const PREFIX = "activity/";
const MAX_ENTRIES = 500; // limit wpisów

// Generuje klucz wpisu: activity/<timestamp>-<random>
const entryKey = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Definicja entry-store'a (bez seed — pusty na start)
const ACTIVITY_ENTRIES = {
  storeName: STORE_NAME,
  prefix: PREFIX,
  legacyKey: null,
  seed: null,
  toEntries: () => [],
};

// Pobiera i sortuje wpisy (najnowsze pierwsze)
const getSortedActivities = async (event) => {
  const { entries } = await readEntryStore(event, ACTIVITY_ENTRIES);
  return entries
    .sort((a, b) => (b.data.timestamp || 0) - (a.data.timestamp || 0))
    .slice(0, MAX_ENTRIES)
    .map((e) => e.data);
};

exports.handler = async (event) => {
  const headers = corsHeaders(event);

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // GET — pobierz log aktywności
    if (event.httpMethod === "GET") {
      const activities = await getSortedActivities(event);
      return json(200, { ok: true, activities }, headers, event);
    }

    // POST — dodaj wpis do logu (tylko admin z tokenem)
    if (event.httpMethod === "POST") {
      // Rate limit — 30 zapytań/min na IP
      const rl = rateLimit(event, 30);
      if (!rl.allowed) {
        return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
      }

      if (bodyTooLarge(event)) {
        return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
      }

      const body = JSON.parse(event.body || "{}");
      const { access_token, action, targetName, targetType, details } = body;

      if (!access_token || !action || !targetName || !targetType) {
        return json(400, { ok: false, error: "MISSING_FIELDS" }, headers, event);
      }

      // Weryfikuj admina
      const adminCheck = await verifyAdmin(access_token);
      if (!adminCheck.ok || !adminCheck.is_admin) {
        return json(403, { ok: false, error: "NOT_ADMIN" }, headers, event);
      }

      const adminInfo = adminCheck.user || { id: "unknown", username: "Unknown" };

      // Utwórz wpis aktywności
      const activity = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        action, // "add" | "remove"
        targetName,
        targetType, // "personal" | "faction"
        adminId: adminInfo.id,
        adminUsername: adminInfo.username,
        details: details || {}, // np. { reasonKey, evidenceCount }
      };

      const store = await resolveStore(event, STORE_NAME, null, null);
      await writeEntry(store, entryKey(), activity, { onlyIfNew: true });

      // Zwróć zaktualizowaną listę
      const activities = await getSortedActivities(event);
      return json(200, { ok: true, activity, activities }, headers, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, headers, event);
  } catch (err) {
    return handleError(err, "kos-activity", event);
  }
};