// netlify/functions/_lib/discord.js
// Wspólne funkcje pomocnicze dla funkcji Netlify.
//
// WYMAGANE ZMIENNE ŚRODOWISKOWE (ustaw w panelu Netlify):
//   DISCORD_BOT_TOKEN       - token bota Discord (https://discord.com/developers/applications)
//   ZPK_GUILD_IDS           - ID serwerów do sprawdzania, oddzielone przecinkami
//                             (np. "1445399610414858340,1368589684858683453" =
//                             oficjalny + dev).
//   ZPK_ADMIN_ROLE_IDS      - ID ról administracyjnych. Format:
//      guildId:roleId,guildId:roleId  → rola pasuje TYLKO na danym serwerze.
//      Można mieszać:       "serwerA:111,serwerB:222,serwerC:333"
//   ZPK_MEMBER_ROLE_IDS     - ID ról członkowsich (tylko do odznaki w UI).
//                             Format: guildId:roleId,guildId:roleId
//
// AUTO-ADMIN (bez podawania ról): właściciel serwera (guild.owner) oraz każdy
// z uprawnieniem ADMINISTRATOR (bit 8) na którymkolwiek z serwerów z listy
// dostaje dostęp administracyjny automatycznie.
//
// Bot musi być dodany na serwer oraz mieć włączony INTENT "Server Members"
// w ustawieniach aplikacji Discord, żeby pobierać role członków.

// Uprawnienie ADMINISTRATOR w Discordzie = bit 8 w polu "permissions".
const PERMISSION_ADMINISTRATOR = 8n;

// CORS i JSON delegujemy do security.js (allowlista domen zamiast "*").
const { corsHeaders } = require("./security");

// Walidacja zmiennych środowiskowych przy ładowaniu modułu
if (!process.env.DISCORD_BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN environment variable is required");
}
if (!process.env.ZPK_GUILD_IDS) {
  throw new Error("ZPK_GUILD_IDS environment variable is required");
}
if (!process.env.ZPK_ADMIN_ROLE_IDS) {
  throw new Error("ZPK_ADMIN_ROLE_IDS environment variable is required");
}
if (!process.env.ZPK_MEMBER_ROLE_IDS) {
  throw new Error("ZPK_MEMBER_ROLE_IDS environment variable is required");
}

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let meRes;
  try {
    meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!meRes.ok) return { ok: false, error: "INVALID_TOKEN", is_admin: false };
  const me = await meRes.json();

  // 2. Serwery użytkownika (OAuth zwraca też flagę owner + uprawnienia)
  const controller2 = new AbortController();
  const timeout2 = setTimeout(() => controller2.abort(), 5000);
  let guildsRes;
  try {
    guildsRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller2.signal,
    });
  } finally {
    clearTimeout(timeout2);
  }
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
    const controller3 = new AbortController();
    const timeout3 = setTimeout(() => controller3.abort(), 5000);
    let memberRes;
    try {
      memberRes = await fetch(
        `https://discord.com/api/guilds/${g.id}/members/${me.id}`,
        { headers: { Authorization: `Bot ${botToken}` }, signal: controller3.signal }
      );
    } finally {
      clearTimeout(timeout3);
    }
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

// Sprawdza rolę CZŁONKOWSKĄ (np. "Członek Klanu") u użytkownika z access_token.
// Wyłącznie status do odznaki w UI — funkcja NIGDY nie nadaje uprawnień
// (zwracany jest wyłącznie is_clan_member, żadnego is_admin).
// Role z konfiguracji są zasięgu "guildId:roleId" — sprawdzamy tylko
// serwery z listy, na których użytkownik faktycznie jest.
async function verifyClanMember(accessToken) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, error: "BOT_NOT_CONFIGURED", is_clan_member: false };
  }

  const memberEntries = parseAdminRoleConfig(
    process.env.ZPK_MEMBER_ROLE_IDS || DEFAULT_MEMBER_ROLES
  );
  if (memberEntries.length === 0) {
    return { ok: false, error: "MEMBER_ROLES_NOT_CONFIGURED", is_clan_member: false };
  }

  // 1. Tożsamość użytkownika (OAuth)
  const controller4 = new AbortController();
  const timeout4 = setTimeout(() => controller4.abort(), 5000);
  let meRes2;
  try {
    meRes2 = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller4.signal,
    });
  } finally {
    clearTimeout(timeout4);
  }
  if (!meRes2.ok) return { ok: false, error: "INVALID_TOKEN", is_clan_member: false };
  const me = await meRes2.json();

  // 2. Serwery użytkownika — interesują nas tylko te z konfiguracji ról
  const controller5 = new AbortController();
  const timeout5 = setTimeout(() => controller5.abort(), 5000);
  let guildsRes2;
  try {
    guildsRes2 = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller5.signal,
    });
  } finally {
    clearTimeout(timeout5);
  }
  if (!guildsRes2.ok) {
    return { ok: false, error: "GUILDS_FETCH_FAILED", is_clan_member: false };
  }
  const guildsData = await guildsRes2.json();
  const guilds = Array.isArray(guildsData) ? guildsData : [];
  const userGuildIds = new Set(guilds.map((g) => g.id));
  const wantedGuildIds = [...new Set(memberEntries.map((e) => e.guildId).filter(Boolean))];
  const presentGuilds = wantedGuildIds.filter((gid) => userGuildIds.has(gid));
  if (presentGuilds.length === 0) {
    return {
      ok: true,
      is_member: false,
      is_clan_member: false,
      user: { id: me.id, username: me.username || me.global_name || null },
    };
  }

  // 3. Role przez bota (tylko na serwerach, gdzie użytkownik jest)
  let isClanMember = false;
  for (const gid of presentGuilds) {
    const controller6 = new AbortController();
    const timeout6 = setTimeout(() => controller6.abort(), 5000);
    let memberRes;
    try {
      memberRes = await fetch(
        `https://discord.com/api/guilds/${gid}/members/${me.id}`,
        { headers: { Authorization: `Bot ${botToken}` }, signal: controller6.signal }
      );
      if (!memberRes.ok) continue;
      const member = await memberRes.json();
      const roles = Array.isArray(member.roles) ? member.roles : [];
      if (memberEntries.some((e) => e.guildId === gid && roles.includes(e.roleId))) {
        isClanMember = true;
        break;
      }
    } catch (e) {
      continue; // pojedynczy serwer padł — sprawdzamy dalej / zwracamy co mamy
    } finally {
      clearTimeout(timeout6);
    }
  }

  return {
    ok: true,
    is_member: presentGuilds.length > 0,
    is_clan_member: isClanMember,
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

  const controller7 = new AbortController();
  const timeout7 = setTimeout(() => controller7.abort(), 5000);
  let res;
  try {
    res = await fetch("https://catbox.moe/user/api.php", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "User-Agent": "ZPK-Site/1.0 (Netlify Function; https://zpk.netlify.app)",
      },
      body: Buffer.concat([header, buffer, footer]),
      signal: controller7.signal,
    });
  } finally {
    clearTimeout(timeout7);
  }

  const text = (await res.text()).trim();
  if (!res.ok || !text.startsWith("http")) {
    return { ok: false, error: "UPLOAD_SERVICE_ERROR", detail: text.slice(0, 200) };
  }
  return { ok: true, url: text };
}

module.exports = { verifyAdmin, verifyClanMember, uploadToCatbox, json, corsHeaders };
