// netlify/functions/_lib/discord.js
// Wspólne funkcje pomocnicze dla funkcji Netlify.
//
// WYMAGANE ZMIENNE ŚRODOWISKOWE (ustaw w panelu Netlify):
//   DISCORD_BOT_TOKEN  - token bota Discord (https://discord.com/developers/applications)
//   ZPK_GUILD_ID       - ID głównego serwera frakcji
//   ZPK_ADMIN_ROLE_IDS - ID ról administracyjnych oddzielone przecinkami
//
// Bot musi być dodany na serwer oraz mieć włączony INTENT "Server Members"
// w ustawieniach aplikacji Discord, żeby pobierać role członków.

const DEFAULT_GUILD_ID = "1445399610414858340";

// CORS i JSON delegujemy do security.js (allowlista domen zamiast "*").
const { corsHeaders } = require("./security");

// event jest opcjonalny — bez niego (np. serwer-to-serwer) zwracamy "*",
// a z eventem CORS idzie przez allowlistę domen z security.js.
function json(statusCode, payload, extraHeaders = {}, event) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders(event), ...extraHeaders },
    body: JSON.stringify(payload),
  };
}

// Sprawdza, czy użytkownik (po access_token z OAuth) ma rolę administracyjną.
async function verifyAdmin(accessToken) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.ZPK_GUILD_ID || DEFAULT_GUILD_ID;
  const adminRoleIds = (process.env.ZPK_ADMIN_ROLE_IDS || "1525241779870236823,1525241778763202821,1525241777592733756,1525241776665923645,1525241775692972063,1525241774279491726,1525241773453217832,1525241771393548328,1525241770336583861")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!botToken) return { ok: false, error: "BOT_NOT_CONFIGURED", is_admin: false };
  if (adminRoleIds.length === 0) return { ok: false, error: "ROLES_NOT_CONFIGURED", is_admin: false };

  // 1. Tożsamość użytkownika
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) return { ok: false, error: "INVALID_TOKEN", is_admin: false };
  const me = await meRes.json();

  // 2. Członkostwo w serwerze
  const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const guilds = await guildsRes.json();
  const isMember = Array.isArray(guilds) && guilds.some((g) => g.id === guildId);
  if (!isMember) return { ok: true, is_member: false, is_admin: false };

  // 3. Role użytkownika w serwerze (przez bota)
  const memberRes = await fetch(
    `https://discord.com/api/guilds/${guildId}/members/${me.id}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );
  if (!memberRes.ok) {
    return { ok: true, is_member: true, is_admin: false, role_error: memberRes.status };
  }
  const member = await memberRes.json();
  const userRoles = Array.isArray(member.roles) ? member.roles : [];
  const isAdmin = userRoles.some((r) => adminRoleIds.includes(r));

  // Zwracamy też info o adminie (id + username) — potrzebne do audit logu
  // w funkcjach (kos-store, announce, upload-evidence).
  return {
    ok: true,
    is_member: true,
    is_admin: isAdmin,
    roles: userRoles,
    user: {
      id: me.id,
      username: me.username || me.global_name || null,
    },
  };
}

// Uploaduje zdjęcie do Catbox.moe (anonimowo, bez konta).
// Zwalnia z problemów CORS - całe żądanie idzie po stronie serwera.
// Uwaga: Catbox odrzuca żądania bez User-Agent, dlatego ustawiamy własny.
async function uploadToCatbox(filename, base64Data) {
  const buffer = Buffer.from(base64Data, "base64");
  const boundary = `----ZPK${Date.now()}`;

  // MIME po rozszerzeniu pliku (domyślnie image/png)
  const ext = (filename || "").toLowerCase().split(".").pop();
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "gif"
      ? "image/gif"
      : ext === "webp"
      ? "image/webp"
      : "image/png";

  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="reqtype"\r\n\r\nfileupload\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="fileToUpload"; filename="${filename}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "User-Agent": "ZPK-Site/1.0 (Netlify Function; https://zpk.netlify.app)",
    },
    body: Buffer.concat([header, buffer, footer]),
  });

  const text = (await res.text()).trim();
  if (!res.ok || !text.startsWith("http")) {
    return { ok: false, error: "UPLOAD_SERVICE_ERROR", detail: text.slice(0, 200) };
  }
  return { ok: true, url: text };
}

module.exports = { verifyAdmin, uploadToCatbox, json, corsHeaders };
