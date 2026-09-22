// netlify/functions/verify-member.js
// Odznaka "Członek Klanu" w UI — sprawdzenie roli CZŁONKOWSKIEJ.
//
// POST /api/verify-member  { "access_token": "..." }
//   → 200 { ok, is_member, is_clan_member, user }
//
// WAŻNE: to wyłącznie status do wyświetlenia (odznaka przy profilu).
// Funkcja NIE nadaje żadnych uprawnień — admin to wyłącznie /api/verify-admin.
// Rola: ZPK_MEMBER_ROLE_IDS (default: oficjalny serwer + rola "Członek Klanu").
// Nadpisywalna na Netlify bez zmiany kodu.

const { verifyClanMember, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, handleError } = require("./_lib/security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  }

  try {
    // Odznaka to tani odczyt — 30/min na IP
    const rl = rateLimit(event, 30);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    const { access_token } = JSON.parse(event.body || "{}");
    if (!access_token) {
      return json(400, { ok: false, error: "MISSING_FIELDS" }, {}, event);
    }

    // ok:false (np. INVALID_TOKEN) idzie jako 200 — frontend traktuje to
    // po prostu jako "bez odznaki", bez błędu w UI.
    const result = await verifyClanMember(access_token);
    return json(200, result, {}, event);
  } catch (err) {
    return handleError(err, "verify-member", event);
  }
};
