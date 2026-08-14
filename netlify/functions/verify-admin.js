// netlify/functions/verify-admin.js
// Sprawdza, czy zalogowany użytkownik Discord ma rolę administracyjną.
// Wywołanie: POST /api/verify-admin  { "access_token": "..." }
// Wymaga zmiennych środowiskowych: DISCORD_BOT_TOKEN, ZPK_GUILD_ID, ZPK_ADMIN_ROLE_IDS

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, handleError } = require("./_lib/security");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    // 204 nie może mieć body — zwracamy sam status + nagłówki CORS.
    // Preflight waliduje origin (allowlista z security.js) — obca domena
    // nie przejdzie nawet preflight.
    return {
      statusCode: 204,
      headers: corsHeaders(event),
      body: "",
    };
  }

  try {
    // Rate limit — 60 zapytań/min na IP (verify-admin to częsty cel skryptów)
    const rl = rateLimit(event, 60);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    const { access_token } = JSON.parse(event.body || "{}");
    if (!access_token) {
      return json(400, { ok: false, error: "NO_TOKEN" }, {}, event);
    }

    const result = await verifyAdmin(access_token);
    return json(200, result, {}, event);
  } catch (err) {
    return handleError(err, "verify-admin", event);
  }
};
