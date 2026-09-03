// netlify/functions/announce-history.js
// Zwraca historię ogłoszeń (ostatnie 50) — czyta z Netlify Blobs, gdzie
// zapisuje je funkcja announce.js przy każdym nadaniu.
// Wywołanie: GET /api/announce-history
// Dostępne dla wszystkich (ogłoszenia są publiczne) — rate limit chroni
// przed spamem, CORS z allowlistą domen.

const { json, corsHeaders } = require("./_lib/discord");
const { rateLimit, handleError } = require("./_lib/security");
const { defineStore, readStore } = require("./_lib/blobStore");

const STORE_NAME = "zpk-announce";
const BLOB_KEY = "history";
const LIMIT = 50;

// Definicja store'a (rejestr w blobStore) — polityka read-only:
// czysty odczyt + normalize (limit 50), zero zapisów do chmury.
const ANNOUNCE_HISTORY_STORE = defineStore({
  storeName: STORE_NAME,
  key: BLOB_KEY,
  seed: [],
  normalize: (raw) => (Array.isArray(raw) ? raw : []).slice(0, LIMIT),
  seedPolicy: "read-only",
});

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    // Rate limit — 30 odczytów/min na IP (wystarczy na dzwonek)
    const rl = rateLimit(event, 30);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    let history = [];
    try {
      const { data } = await readStore(event, ANNOUNCE_HISTORY_STORE);
      history = data;
    } catch (blobErr) {
      // Blobs niedostępny — zwracamy pustą historię zamiast błędu,
      // żeby dzwonek pokazywał "BRAK OGŁOSZEŃ" zamiast crasha.
      console.warn("announce-history: blobs unavailable:", blobErr.message);
    }

    return json(200, { ok: true, history }, {}, event);
  } catch (err) {
    return handleError(err, "announce-history", event);
  }
};
