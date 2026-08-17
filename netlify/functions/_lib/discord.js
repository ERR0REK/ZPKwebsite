// netlify/functions/_lib/discord.js
// Wspólne funkcje pomocnicze dla funkcji Netlify.
//
// WYMAGANE ZMIENNE ŚRODOWISKOWE (ustaw w panelu Netlify):
//   DISCORD_BOT_TOKEN      - token bota Discord (https://discord.com/developers/applications)
//   ZPK_GUILD_IDS          - ID serwerów do sprawdzania, oddzielone przecinkami
//                            (np. "1445399610414858340,1368589684858683453" =
//                            oficjalny + dev). Domyślnie: sam oficjalny.
//   ZPK_ADMIN_ROLE_IDS     - ID ról administracyjnych. Dwa formaty:
//      1) goła rola:        "111,222"      → pasuje na DOWOLNYM serwerze z ZPK_GUILD_IDS
//      2) rola przypisana:  "serwerA:111"  → pasuje TYLKO na serwerzeA
//      Można mieszać:       "111,serwerA:222,serwerB:333"
//
// AUTO-ADMIN (bez podawania ról): właściciel serwera (guild.owner) oraz każdy
// z uprawnieniem ADMINISTRATOR (bit 8) na którymkolwiek z serwerów z listy
// dostaje dostęp administracyjny automatycznie.
//
// Bot musi być dodany na serwer oraz mieć włączony INTENT "Server Members"
// w ustawieniach aplikacji Discord, żeby pobierać role członków.

const DEFAULT_GUILD_ID = "1445399610414858340";

// Domyślne role admina (oficjalny serwer frakcji) — nadal można nadpisać
// zmienną ZPK_ADMIN_ROLE_IDS.
const DEFAULT_ADMIN_ROLES =
  "1525241779870236823,1525241778763202821,1525241777592733756,1525241776665923645,1525241775692972063,1525241774279491726,1525241773453217832,1525241771393548328,1525241770336583861";

// Uprawnienie ADMINISTRATOR w Discordzie = bit 8 w polu "permissions".
const PERMISSION_ADMINISTRATOR = 8n;

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

// Parsuje ZPK_ADMIN_ROLE_IDS do listy wpisów:
//   { guildId: null, roleId }  → rola pasuje na DOWOLNYM serwerze,
//   { guildId: "...", roleId } → rola pasuje TYLKO na tym serwerze.
function parseAdminRoleConfig(raw) {
  const entries = [];
  (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf(":");
      if (idx > 0) {
        const guildId = part.slice(0, idx).trim();
        const roleId = part.slice(idx + 1).trim();
        if (guildId && roleId) entries.push({ guildId, roleId });
      } else if (part) {
        entries.push({ guildId: null, roleId: part });
      }
    });
  return entries;
}

// Sprawdza, czy użytkownik (po access_token z OAuth) ma rolę administracyjną.
//
// Zasady (w kolejności):
//  1. Właściciel serwera (guild.owner) → auto-admin,
//  2. Uprawnienie ADMINISTRATOR (bit 8) → auto-admin,
//  3. Rola z ZPK_ADMIN_ROLE_IDS (goła = dowolny serwer, "serwer:rola" = ten serwer).
async function verifyAdmin(accessToken) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildIds = (process.env.ZPK_GUILD_IDS || DEFAULT_GUILD_ID)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const roleEntries = parseAdminRoleConfig(
    process.env.ZPK_ADMIN_ROLE_IDS || DEFAULT_ADMIN_ROLES
  );

  if (guildIds.length === 0) return { ok: false, error: "GUILDS_NOT_CONFIGURED", is_admin: false };

  // 1. Tożsamość użytkownika
  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!meRes.ok) return { ok: false, error: "INVALID_TOKEN", is_admin: false };
  const me = await meRes.json();

  // 2. Serwery użytkownika (OAuth zwraca też flagę owner + uprawnienia)
  const guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!guildsRes.ok) {
    return { ok: true, is_member: false, is_admin: false, error: "GUILDS_FETCH_FAILED" };
  }
  const guildsData = await guildsRes.json();
  const guilds = Array.isArray(guildsData) ? guildsData : [];
  const checkedGuilds = guilds.filter((g) => guildIds.includes(g.id));
  if (checkedGuilds.length === 0) {
    return { ok: true, is_member: false, is_admin: false, guilds: [] };
  }

  const guildSummary = checkedGuilds.map((g) => ({
    id: g.id,
    name: g.name || null,
    owner: g.owner === true,
  }));

  // 3. AUTO-ADMIN: właściciel serwera LUB uprawnienie ADMINISTRATOR
  //    → nie trzeba trzymać listy ról dla takich osób.
  const autoAdmin = checkedGuilds.find(
    (g) =>
      g.owner === true ||
      (typeof g.permissions === "string" &&
        (BigInt(g.permissions) & PERMISSION_ADMINISTRATOR) !== 0n)
  );
  if (autoAdmin) {
    return {
      ok: true,
      is_member: true,
      is_admin: true,
      via: autoAdmin.owner === true ? "owner" : "administrator",
      guilds: guildSummary,
      user: { id: me.id, username: me.username || me.global_name || null },
    };
  }

  // 4. Role użytkownika na KAŻDYM z serwerów (przez bota).
  //    Bot jest potrzebny TYLKO tutaj — auto-admin (owner/Administrator)
  //    działa wyłącznie na danych OAuth, bez DISCORD_BOT_TOKEN.
  if (!botToken) return { ok: false, error: "BOT_NOT_CONFIGURED", is_admin: false };
  const memberGuilds = [];
  let roleErrors = [];
  for (const g of checkedGuilds) {
    const memberRes = await fetch(
      `https://discord.com/api/guilds/${g.id}/members/${me.id}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (!memberRes.ok) {
      roleErrors.push(g.id);
      continue;
    }
    const member = await memberRes.json();
    memberGuilds.push({
      id: g.id,
      name: g.name || null,
      roles: Array.isArray(member.roles) ? member.roles : [],
    });
  }

  const allRoles = memberGuilds.flatMap((m) => m.roles);
  const isAdmin = roleEntries.some((entry) =>
    entry.guildId
      ? (() => {
          const g = memberGuilds.find((m) => m.id === entry.guildId);
          return !!g && g.roles.includes(entry.roleId);
        })()
      : allRoles.includes(entry.roleId)
  );

  // Zwracamy też info o adminie (id + username) — potrzebne do audit logu
  // w funkcjach (kos-store, announce, upload-evidence).
  return {
    ok: true,
    is_member: true,
    is_admin: isAdmin,
    roles: allRoles,
    role_error: roleErrors.length > 0 ? roleErrors : undefined,
    guilds: guildSummary,
    user: { id: me.id, username: me.username || me.global_name || null },
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
