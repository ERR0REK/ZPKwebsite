// netlify/functions/verify-admin.js
// Sprawdza, czy zalogowany użytkownik Discord ma rolę administracyjną.
// Wywołanie: POST /api/verify-admin  { "access_token": "..." }
// Wymaga zmiennych środowiskowych: DISCORD_BOT_TOKEN, ZPK_GUILD_ID, ZPK_ADMIN_ROLE_IDS

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    // 204 nie może mieć body — zwracamy sam status + nagłówki CORS
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  try {
    const { access_token } = JSON.parse(event.body || "{}");
    if (!access_token) {
      return json(400, { ok: false, error: "NO_TOKEN" });
    }

    const result = await verifyAdmin(access_token);
    return json(200, result);
  } catch (err) {
    console.error("verify-admin error:", err);
    return json(500, { ok: false, error: "SERVER_ERROR" });
  }
};
