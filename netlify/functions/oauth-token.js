// netlify/functions/oauth-token.js
// Authorization Code Flow + PKCE — wymiana kodu autoryzacji na access_token.
// Client secret przechowywany TYLKO w zmiennych środowiskowych Netlify (DISCORD_CLIENT_SECRET),
// nigdy nie trafia do frontendu.
//
// WYMAGANE ZMIENNE ŚRODOWISKOWE (ustaw w panelu Netlify):
//   DISCORD_CLIENT_ID     - Client ID aplikacji Discord
//   DISCORD_CLIENT_SECRET - Client Secret aplikacji Discord (TAJNY!)
//   REACT_APP_GUILD_ID    - ID serwera (opcjonalnie, dla weryfikacji)

const { corsHeaders, json } = require("./_lib/security");

// Endpoint: POST /api/oauth/token
// Body: { code: string, code_verifier: string }
// Response: { access_token, token_type, expires_in, refresh_token, scope }
exports.handler = async (event) => {
  // Tylko POST
  if (event.httpMethod !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" }, {}, event);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "INVALID_JSON" }, {}, event);
  }

  const { code, code_verifier } = body;
  if (!code || !code_verifier) {
    return json(400, { error: "MISSING_PARAMETERS" }, {}, event);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.REACT_APP_OAUTH_REDIRECT_URI || `https://${process.env.URL || "localhost:8888"}/#/auth/callback`;

  if (!clientId || !clientSecret) {
    console.error("OAuth credentials not configured");
    return json(500, { error: "SERVER_MISCONFIGURED" }, {}, event);
  }

  // Wymień code na token u Discorda (Authorization Code Flow + PKCE)
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    code_verifier,
    redirect_uri: redirectUri
  });

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", tokenData);
      // Nie ujawniaj szczegółów błędu Discorda do frontendu
      return json(400, { error: "TOKEN_EXCHANGE_FAILED" }, {}, event);
    }

    // Zwróć token do frontendu (access_token, token_type, expires_in, refresh_token, scope)
    return json(200, tokenData, {}, event);
  } catch (err) {
    console.error("Token exchange error:", err);
    return json(500, { error: "TOKEN_EXCHANGE_ERROR" }, {}, event);
  }
};