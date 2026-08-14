// netlify/functions/announce-history.js
// Zwraca historię ogłoszeń (ostatnie 50) — czyta z Netlify Blobs, gdzie
// zapisuje je funkcja announce.js przy każdym nadaniu.
// Wywołanie: GET /api/announce-history
// Dostępne dla wszystkich (ogłoszenia są publiczne) — rate limit chroni
// przed spamem, CORS z allowlistą domen.

const { getStore } = require("@netlify/blobs");
const { json, corsHeaders } = require("./_lib/discord");
const { rateLimit, handleError } = require("./_lib/security");

const STORE_NAME = "zpk-announce";
const BLOB_KEY = "history";
const LIMIT = 50;

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
      const store = getStore({ name: STORE_NAME });
      const existing = await store.getJSON(BLOB_KEY, { type: "json" });
      if (Array.isArray(existing)) history = existing;
    } catch (blobErr) {
      // Blobs niedostępny — zwracamy pustą historię zamiast błędu,
      // żeby dzwonek pokazywał "BRAK OGŁOSZEŃ" zamiast crasha.
      console.warn("announce-history: blobs unavailable:", blobErr.message);
    }

    return json(200, { ok: true, history: history.slice(0, LIMIT) }, {}, event);
  } catch (err) {
    return handleError(err, "announce-history", event);
  }
};
