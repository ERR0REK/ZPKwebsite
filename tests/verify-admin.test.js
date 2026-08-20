// Test rozbudowanego verifyAdmin (wielu serwerów + auto-admin owner/administrator).
const assert = require("assert");
const { verifyAdmin } = require("../netlify/functions/_lib/discord");

const MAIN = "1445399610414858340";
const DEV = "1368589684858683453";

function setupFetch({ guilds = [], memberRoles = {} }) {
  global.fetch = async (url) => {
    if (url === "https://discord.com/api/users/@me") {
      return { ok: true, status: 200, json: async () => ({ id: "111", username: "Test" }) };
    }
    if (url === "https://discord.com/api/users/@me/guilds") {
      return { ok: true, status: 200, json: async () => guilds };
    }
    const m = url.match(/^https:\/\/discord\.com\/api\/guilds\/(\d+)\/members\/(\d+)$/);
    if (m) {
      if (memberRoles[m[1]] === undefined) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ user: { id: m[2] }, roles: memberRoles[m[1]] }),
      };
    }
    throw new Error("unexpected fetch: " + url);
  };
}

process.env.DISCORD_BOT_TOKEN = "bot-token";

(async () => {
  // 1. WŁAŚCICIEL serwera → auto-admin (via: owner), bez żadnej roli.
  process.env.ZPK_GUILD_IDS = `${MAIN},${DEV}`;
  process.env.ZPK_ADMIN_ROLE_IDS = "SOME_ROLE";
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: true, permissions: "8" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
  });
  let r = await verifyAdmin("tok");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.is_admin, true, "właściciel musi być adminem");
  assert.strictEqual(r.via, "owner");
  assert.deepStrictEqual(r.roles, undefined, "nie powinno być fetcha ról przy auto-adminie");

  // 2. Uprawnienie ADMINISTRATOR (bit 8) → auto-admin (via: administrator).
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "104324697" }, // 104324697 = 104324689 + 8 (bit Administrator ustawiony)
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "Administrator musi być adminem");
  assert.strictEqual(r.via, "administrator");

  // 3. Bez auto-admina — brak roli → nie admin.
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["OTHER"], [DEV]: ["OTHER2"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, false, "bez roli i bez auto-admina = nie admin");
  assert.strictEqual(r.is_member, true);

  // 4. GOŁA rola (bez serwera) pasuje na DOWOLNYM serwerze z listy.
  process.env.ZPK_ADMIN_ROLE_IDS = "ROLE_X,ROLE_Y";
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["OTHER"], [DEV]: ["ROLE_X"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "goła rola w DEV musi dać admina");

  // 5. Rola przypisana do serwera ("serwer:rola") — NIE pasuje na innym serwerze.
  process.env.ZPK_ADMIN_ROLE_IDS = `${MAIN}:ADMIN_ROLE`;
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["OTHER"], [DEV]: ["ADMIN_ROLE"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, false, "rola ADMIN_ROLE jest w DEV, ale przypisana do MAIN");

  // 6. Rola przypisana do serwera — pasuje na swoim serwerze.
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["ADMIN_ROLE"], [DEV]: ["OTHER"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "rola ADMIN_ROLE jest w MAIN = admin");

  // 7. Mieszanka: goła rola + rola przypisana do serwera.
  process.env.ZPK_ADMIN_ROLE_IDS = `GLOBAL_ROLE,${DEV}:DEV_ADMIN`;
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["OTHER"], [DEV]: ["DEV_ADMIN"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "DEV_ADMIN przypisana do DEV musi działać");

  // 8. Użytkownik spoza wszystkich skonfigurowanych serwerów.
  setupFetch({ guilds: [{ id: "999", name: "Other", owner: true, permissions: "8" }] });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_member, false);
  assert.strictEqual(r.is_admin, false);

  // 9. Legacy: tylko oficjalny serwer, gołe role (jak działało wcześniej).
  process.env.ZPK_GUILD_IDS = MAIN;
  process.env.ZPK_ADMIN_ROLE_IDS = "ADMIN_ROLE";
  setupFetch({
    guilds: [{ id: MAIN, name: "Main", owner: false, permissions: "0" }],
    memberRoles: { [MAIN]: ["ADMIN_ROLE"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "legacy (goła rola, jeden serwer) musi działać");

  // 10. Role z wielu serwerów zebrane — goła rola pasuje przez sumę ról.
  process.env.ZPK_GUILD_IDS = `${MAIN},${DEV}`;
  process.env.ZPK_ADMIN_ROLE_IDS = "SHARED_ROLE";
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["OTHER"], [DEV]: ["SHARED_ROLE"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true);

  // 11. BEZ tokena bota, ale właściciel serwera → nadal admin (auto-admin
  //     działa wyłącznie na danych OAuth — bot nie jest potrzebny).
  delete process.env.DISCORD_BOT_TOKEN;
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: true, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "owner bez tokena bota musi być adminem");
  assert.strictEqual(r.via, "owner");

  // 12. BEZ tokena bota i bez auto-admina → BOT_NOT_CONFIGURED (rola wymaga bota).
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["SOME_ROLE"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, "BOT_NOT_CONFIGURED");
  process.env.DISCORD_BOT_TOKEN = "bot-token";

  // 13. Prawdziwe role ZPK — Elder na DEV serwerze → admin na DEV, NIE na MAIN.
  process.env.ZPK_ADMIN_ROLE_IDS = `${DEV}:1455480152883466351`;
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["OTHER"], [DEV]: ["1455480152883466351"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "Elder na DEV musi być adminem");

  // 14. Ta sama rola Elder DEV → NIE admin na MAIN (przypisana do DEV).
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: false, permissions: "0" },
    ],
    memberRoles: { [MAIN]: ["1455480152883466351"], [DEV]: ["OTHER"] },
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, false, "Elder DEV nie daje dostępu na MAIN");

  // 15. Właściciel DEV serweru → auto-admin (via: owner).
  setupFetch({
    guilds: [
      { id: MAIN, name: "Main", owner: false, permissions: "0" },
      { id: DEV, name: "Dev", owner: true, permissions: "0" },
    ],
  });
  r = await verifyAdmin("tok");
  assert.strictEqual(r.is_admin, true, "Owner DEV musi być adminem");
  assert.strictEqual(r.via, "owner");

  console.log("ALL 15 TESTS PASSED ✅");
})().catch((err) => {
  console.error("TEST FAILED:", err.message);
  process.exit(1);
});
