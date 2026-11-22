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
// Token zawiera clientId (Discord user ID) — wymagane na kontach MAU.
//
// Wywołanie: POST /api/ably-token-request (authCallback z frontendu)
//   - body: { clientId?: string, capability?: object, ttl?: number }
//   - zwraca JSON z Token Request (obiekt z keyName, ttl, capability, mac)

const { createHttpClient } = require("@ably/pubsub-server");
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

// Domyślna capability — subscribe na wiadomościach, presence tylko na zpk-presence.
// (Wejście w presence wymaga capability "presence", bez tego 40160.)
const DEFAULT_CAPABILITY = Object.fromEntries(
  SUBSCRIBE_CHANNELS.map((ch) => [
    ch,
    ch === "zpk-presence" ? ["subscribe", "presence"] : ["subscribe"],
  ])
);

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

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      // ignore, użyjemy domyślnych
    }

    // Capability i TTL ustala serwer — klient nie może ich rozszerzyć (np. o publish).
    // clientId to tylko tożsamość presence: Discord user ID albo anonim.
    const finalClientId =
      typeof body.clientId === "string" && /^[\w-]{1,64}$/.test(body.clientId)
        ? body.clientId
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // HTTP client z kluczem ROOT — generuje podpisany Token Request.
    const http = createHttpClient({ key: process.env.ABLY_API_KEY });
    const tokenRequest = await http.auth.createTokenRequest({
      ttl: TTL_MS,
      capability: DEFAULT_CAPABILITY,
      clientId: finalClientId
    });

    return json(200, tokenRequest, {}, event);
  } catch (err) {
    return handleError(err, "ably-token-request", event);
  }
};