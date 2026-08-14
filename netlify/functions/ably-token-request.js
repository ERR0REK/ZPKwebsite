// netlify/functions/ably-token-request.js
//
// TOKEN AUTH (zamiast klucza w bundlu):
// Frontend nie dostaje żadnego klucza Ably. Zamiast tego łączy się przez
// authUrl → ta funkcja generuje KRÓTKOŻYJĄCY Token Request (TTL 1h)
// z klucza ROOT (ABLY_API_KEY), który NIGDY nie opuszcza backendu.
//
// Token ma ograniczone uprawnienia: tylko SUBSCRIBE na kanałach frakcji.
// Nawet gdyby ktoś przechwycił token — wygasa po godzinie i nie może
// publikować.
//
// Wywołanie: GET /api/ably-token-request (Ably SDK robi to automatycznie)
//   - zwraca JSON z Token Request (obiekt z keyName, ttl, capability, mac)
//   - wspiera JSONP (parametr ?callback=) — fallback SDK w przeglądarce

const Ably = require("ably");
const { json, corsHeaders } = require("./_lib/discord");
const { rateLimit, handleError } = require("./_lib/security");

// Kanały, do których frontend może się podłączać (tylko do słuchania).
const SUBSCRIBE_CHANNELS = [
  "zpk-announcements",
  "zpk-activity",
  "zpk-kos-updates",
  "zpk-presence",
  "zpk-war-status",
  "zpk-discord-stats"
];

const TTL_MS = 60 * 60 * 1000; // token ważny 1 godzinę (krótkożyjący)
const RATE_LIMIT = 240; // klient wznawia połączenie co chwilę — wysoki limit

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    const rl = rateLimit(event, RATE_LIMIT);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (!process.env.ABLY_API_KEY) {
      return json(500, { ok: false, error: "ABLY_NOT_CONFIGURED" }, {}, event);
    }

    // Capability — mapa kanał → dozwolone operacje. Tylko subscribe!
    const capability = {};
    SUBSCRIBE_CHANNELS.forEach((ch) => {
      capability[ch] = ["subscribe"];
    });

    // Rest-client z kluczem ROOT — generuje podpisany Token Request.
    const client = new Ably.Rest({ key: process.env.ABLY_API_KEY });
    const tokenRequest = await client.auth.createTokenRequest({
      ttl: TTL_MS,
      capability
    });

    // JSONP fallback (Ably SDK używa ?callback= gdy XHR zawiedzie)
    const callback =
      event.queryStringParameters && event.queryStringParameters.callback;
    if (callback) {
      const body = `${callback}(${JSON.stringify(tokenRequest)})`;
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/javascript", ...corsHeaders(event) },
        body
      };
    }

    return json(200, tokenRequest, {}, event);
  } catch (err) {
    return handleError(err, "ably-token-request", event);
  }
};
