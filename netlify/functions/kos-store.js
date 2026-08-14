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

// Pobiera aktualną listę celów (pusta, jeśli jeszcze nic nie zapisano).
async function getTargets() {
  let data = null;
  try {
    data = await getStore(STORE_NAME).getJSON(KEY);
  } catch (err) {
    console.error("kos-store get error:", err);
    return { personal: [], factions: [] };
  }
  if (!data || typeof data !== "object") return { personal: [], factions: [] };
  return {
    personal: Array.isArray(data.personal) ? data.personal : [],
    factions: Array.isArray(data.factions) ? data.factions : [],
  };
}

async function saveTargets(targets) {
  await getStore(STORE_NAME).setJSON(KEY, targets);
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
      const targets = await getTargets();
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
      const targets = await getTargets();
      targets[key] = targets[key].filter((x) => x.name !== name);
      await saveTargets(targets);
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
      const targets = await getTargets();
      targets[key] = upsertTarget(targets[key], target);
      await saveTargets(targets);
      await publishUpdate(type, "added", target.name);
      await audit("kos.add", `${type}: ${target.name}`, admin.user);
      return json(200, { ok: true, ...targets }, {}, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  } catch (err) {
    return handleError(err, "kos-store", event);
  }
};
