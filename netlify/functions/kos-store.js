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

const STORE_NAME = "zpk-kos";
const KEY = "targets";
const MAX_TARGET_SIZE = 50 * 1024; // 50 KB na pojedynczy cel

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
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  try {
    // ==================== GET (odczyt dla wszystkich) ====================
    if (event.httpMethod === "GET") {
      const targets = await getTargets();
      return json(200, { ok: true, ...targets });
    }

    // ============ POST / DELETE (tylko administratorzy) ============
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      return json(400, { ok: false, error: "BAD_JSON" });
    }

    const { access_token, type, name, target } = body;

    // 1. Weryfikacja roli administracyjnej
    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" });
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" });
    }

    if (type !== "personal" && type !== "faction") {
      return json(400, { ok: false, error: "BAD_TYPE" });
    }
    const key = type === "personal" ? "personal" : "factions";

    // 2. DELETE — usuń cel po nazwie
    if (event.httpMethod === "DELETE") {
      if (typeof name !== "string" || name.trim() === "") {
        return json(400, { ok: false, error: "MISSING_NAME" });
      }
      const targets = await getTargets();
      targets[key] = targets[key].filter((x) => x.name !== name);
      await saveTargets(targets);
      return json(200, { ok: true, ...targets });
    }

    // 3. POST — dodaj/aktualizuj cel
    if (event.httpMethod === "POST") {
      if (!isValidTarget(target, type)) {
        return json(400, { ok: false, error: "INVALID_TARGET" });
      }
      const size = Buffer.byteLength(JSON.stringify(target), "utf8");
      if (size > MAX_TARGET_SIZE) {
        return json(413, { ok: false, error: "TARGET_TOO_LARGE" });
      }
      const targets = await getTargets();
      targets[key] = upsertTarget(targets[key], target);
      await saveTargets(targets);
      return json(200, { ok: true, ...targets });
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  } catch (err) {
    console.error("kos-store error:", err);
    return json(500, { ok: false, error: "SERVER_ERROR" });
  }
};
