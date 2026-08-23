// Test logiki SEED + flagi _seeded w kos-store.js — mockujemy Netlify Blobs.
// Scenariusze:
//   1. Baza nigdy nie seedowana (null) → GET zasiewa z kosSeed.json, ustawia _seeded
//   2. Baza seedowana z danymi admina → GET dodaje brakujące cele z seeda
//   3. Baza seedowana i PUSTA (admin usunął) → dodaje cele z seeda (nowa logika)
//   4. Baza NIE seedowana ale ma dane (np. POST przed flagą) → dodaje brakujące z seeda
//   5. Blobs NIEDOSTĘPNE → fallback in-memory z seedem
//   6. Nowe cele w seedzie → scalane z istniejącymi danymi z chmury
// Uruchom: node tests/kos-store-seed.test.js

const assert = require("assert");

// ---- fake Netlify Blobs ----
const storeState = {
  data: null,
  throwOnGet: false,
};
const fakeBlobs = {
  getStore: () => ({
    get: async (_key, options) => {
      if (storeState.throwOnGet) {
        throw new Error(
          "MissingBlobsEnvironmentError: The environment has not been configured to use Netlify Blobs."
        );
      }
      if (options && options.type === "json") return storeState.data ?? null;
      return storeState.data == null ? null : JSON.stringify(storeState.data);
    },
    setJSON: async (_key, value) => {
      storeState.data = value;
    },
  }),
};

// Wstrzykujemy fake do require cache PRZED załadowaniem kos-store.js
const blobsPath = require.resolve("@netlify/blobs");
require.cache[blobsPath] = {
  id: blobsPath,
  filename: blobsPath,
  loaded: true,
  exports: fakeBlobs,
};

function freshHandler() {
  delete require.cache[require.resolve("../netlify/functions/kos-store.js")];
  return require("../netlify/functions/kos-store.js").handler;
}

const seed = require("../netlify/functions/_lib/kosSeed.json");

async function get() {
  const res = await freshHandler()({ httpMethod: "GET", headers: {} });
  return { status: res.statusCode, ...JSON.parse(res.body) };
}

(async () => {
  // ---- Scenariusz 1: baza nigdy nie seedowana (null) → seed + _seeded ----
  storeState.data = null;
  storeState.throwOnGet = false;
  const r1 = await get();
  assert.strictEqual(r1.ok, true, "S1: ok=true");
  assert.strictEqual(r1.personal.length, seed.personal.length, "S1: liczba osob z seeda");
  assert.strictEqual(r1.factions.length, seed.factions.length, "S1: liczba klanów z seeda");
  assert.strictEqual(r1.personal[0].name, seed.personal[0].name, "S1: pierwszy cel z seeda");
  assert.strictEqual(storeState.data._seeded, true, "S1: _seeded=true w zapisanych danych");
  console.log("S1 OK — świeża baza zasiana celami z kodu, _seeded=true");

  // ---- Scenariusz 2: baza seedowana z danymi admina → scalanie z seedem ----
  storeState.data = {
    _seeded: true,
    personal: [{ name: "AdminAdded" }],
    factions: [{ name: "ClanX" }],
  };
  const r2 = await get();
  assert.strictEqual(r2.ok, true, "S2: ok=true");
  // Seed entries (Kerainff, ggxEyx10) should be merged + AdminAdded kept
  assert.strictEqual(r2.personal.length, seed.personal.length + 1, "S2: seed entries + admin entry");
  assert.ok(r2.personal.some(p => p.name === "AdminAdded"), "S2: AdminAdded zachowane");
  assert.ok(r2.personal.some(p => p.name === seed.personal[0].name), "S2: seed entries dodane");
  assert.strictEqual(r2.factions.length, seed.factions.length + 1, "S2: seed factions + admin faction");
  assert.ok(r2.factions.some(f => f.name === "ClanX"), "S2: ClanX zachowane");
  console.log("S2 OK — dane admina zachowane + brakujące cele z seeda dodane");

  // ---- Scenariusz 3: seedowana i PUSTA (admin usunął) → dodajemy cele z seeda ----
  storeState.data = { _seeded: true, personal: [], factions: [] };
  const r3 = await get();
  assert.strictEqual(r3.ok, true, "S3: ok=true");
  assert.strictEqual(r3.personal.length, seed.personal.length, "S3: cele z seeda dodane do pustej");
  assert.strictEqual(storeState.data.personal.length, seed.personal.length, "S3: magazyn zaktualizowany");
  console.log("S3 OK — pusta baza po seedowaniu: cele z seeda dodane");

  // ---- Scenariusz 4: NIE seedowana ale ma dane → dodaje brakujące z seeda ----
  storeState.data = {
    // _seeded brak (nigdy nie było)
    personal: [{ name: "NowaOsobaZPosta" }],
    factions: [],
  };
  const r4 = await get();
  assert.strictEqual(r4.ok, true, "S4: ok=true");
  assert.strictEqual(r4.personal.length, seed.personal.length + 1, "S4: seed + istniejące dane");
  const names4 = r4.personal.map((p) => p.name);
  assert.ok(seed.personal.every(s => names4.includes(s.name)), "S4: wszystkie seed entries dodane");
  assert.ok(names4.includes("NowaOsobaZPosta"), "S4: NowaOsobaZPosta zachowana");
  assert.strictEqual(storeState.data._seeded, true, "S4: _seeded=true po scaleniu");
  console.log("S4 OK — brak _seeded = brakujące cele z seeda dodane");

  // ---- Scenariusz 5: Blobs niedostępne → fallback in-memory ----
  storeState.data = null;
  storeState.throwOnGet = true;
  const r5 = await get();
  assert.strictEqual(r5.status, 200, "S5: status 200 (fallback in-memory)");
  assert.strictEqual(r5.ok, true, "S5: ok=true");
  assert.strictEqual(r5.personal.length, seed.personal.length, "S5: seed w fallbacku");
  // POST bez tokena → 403 (bezpieczeństwo OK)
  const postRes = await freshHandler()({
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: "x", type: "personal", target: { name: "X" } }),
  });
  assert.strictEqual(postRes.statusCode, 403, "S5: POST bez tokena = 403");
  console.log("S5 OK — brak Blobs = fallback in-memory z seedem");

  // ---- Scenariusz 6: Nowe cele w seedzie → scalanie z istniejącymi ----
  storeState.throwOnGet = false;
  storeState.data = {
    _seeded: true,
    personal: [{ name: "StaryCel" }, { name: seed.personal[0].name }],
    factions: [],
  };
  const r6 = await get();
  assert.strictEqual(r6.ok, true, "S6: ok=true");
  // StaryCel + seed entries — seed entries should not duplicate
  const names6 = r6.personal.map(p => p.name);
  assert.ok(names6.includes("StaryCel"), "S6: StaryCel zachowane");
  assert.ok(seed.personal.every(s => names6.includes(s.name)), "S6: wszystkie seed entries obecne");
  // Sprawdź brak duplikatów
  assert.strictEqual(new Set(names6).size, names6.length, "S6: brak duplikatów");
  console.log("S6 OK — nowe cele z seeda scalane bez duplikatów");

  storeState.throwOnGet = false;

  console.log("\n✅ WSZYSTKIE TESTY KOS-STORE PRZESZŁY (6/6)");
})().catch((err) => {
  console.error("❌ TEST FAILED:", err.message);
  process.exit(1);
});
