// netlify/functions/announce.js
// Publikuje ogłoszenie w czasie rzeczywistym do WSZYSTKICH odwiedzających stronę.
// TYLKO dla administratorów (rola z Discorda — weryfikacja przez bota).
// Wywołanie: POST /api/announce
//   { "access_token": "...", "title": "TYTUŁ", "message": "Treść ogłoszenia", "severity": "info" }
//
// Wymagana zmienna środowiskowa (w panelu Netlify, NIE w repo):
//   ABLY_API_KEY — klucz ROOT z panelu Ably (publikacja po stronie serwera).

const Ably = require("ably");
const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");
const { resolveStore } = require("./_lib/blobStore");

const CHANNEL = "zpk-announcements";
const STORE_NAME = "zpk-announce";
const BLOB_KEY = "history";
const HISTORY_LIMIT = 50;
const SEVERITIES = ["info", "warning", "critical"];
const COOLDOWN_MS = 10 * 1000; // min. 10 s między ogłoszeniami od jednego admina

// Prosty cooldown (per-token). Funkcje serverless są efemeryczne, więc to
// ochrona "najlepszej starań", a nie twardy limit — ale odstrasza spam.
const lastAnnounceAt = new Map();

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    // Rate limit — 20 zapytań/min na IP (ogłoszenia są rzadkie)
    const rl = rateLimit(event, 20);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    const { access_token, title, message, severity } = JSON.parse(event.body || "{}");

    if (!access_token || !message || !message.trim()) {
      return json(400, { ok: false, error: "MISSING_FIELDS" }, {}, event);
    }

    // 1. Weryfikacja roli administracyjnej
    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" }, {}, event);
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" }, {}, event);
    }

    // 2. Cooldown — nie spamuj kanału
    const now = Date.now();
    const lastAt = lastAnnounceAt.get(access_token) || 0;
    if (now - lastAt < COOLDOWN_MS) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, {}, event);
    }
    lastAnnounceAt.set(access_token, now);

    if (!process.env.ABLY_API_KEY) {
      return json(500, { ok: false, error: "ABLY_NOT_CONFIGURED" }, {}, event);
    }

    // 3. Walidacja severity (allowlist)
    const safeSeverity = SEVERITIES.includes(severity) ? severity : "info";

    const announcement = {
      title: (title || "ANNOUNCEMENT").slice(0, 80),
      message: message.trim().slice(0, 500),
      severity: safeSeverity,
      timestamp: now,
      author: admin.user ? admin.user.username || admin.user.name || "ADMIN" : "ADMIN"
    };

    // 4. Historia w Netlify Blobs (ostatnie 50 ogłoszeń)
    try {
      const store = await resolveStore(event, STORE_NAME, BLOB_KEY, []);
      const existing = await store.get(BLOB_KEY, { type: "json" });
      const history = Array.isArray(existing) ? existing : [];
      const next = [announcement, ...history].slice(0, HISTORY_LIMIT);
      await store.setJSON(BLOB_KEY, next);
    } catch (blobErr) {
      // Historia to bonus — jeśli Blobs nie odpowie, publikacja żyje dalej.
      console.warn("announce: blob history skipped:", blobErr.message);
    }

    // 5. Publikacja do kanału announcements (klucz ROOT po stronie serwera)
    // UWAGA: publish(name, data) — pojedynczy obiekt byłby zinterpretowany
    // przez SDK jako obiekt wiadomości {name, data} i data by zginęła.
    const client = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
    const channel = client.channels.get(CHANNEL);
    await channel.publish("announce", announcement);
    client.close();

    await audit("announce", `${safeSeverity}: ${announcement.title}`, admin.user);

    return json(200, { ok: true, announcement }, {}, event);
  } catch (err) {
    return handleError(err, "announce", event);
  }
};
