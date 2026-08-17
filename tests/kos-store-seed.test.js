// Test logiki SEED + fallback store w kos-store.js — mockujemy Netlify Blobs.
// Scenariusze:
//   1. Świeża baza (klucz nigdy nie zapisany, getJSON → null) → GET zasiewa z kosSeed.json
//   2. Baza z danymi → GET zwraca dane bez ruszania seeda
//   3. Baza pusta, ale ZAPISANA (admin usunął wszystkie cele) → NIE zasiewa ponownie
//   4. Blobs NIEDOSTĘPNE (getJSON rzuca MissingBlobsEnvironmentError, jak lokalny
//      dev bez konfiguracji) → fallback in-memory: GET działa i zasiewa (200),
//      a nie zwraca 503. (POST bez tokena → 403 NO_TOKEN, bezpieczeństwo przed Blobs)
// Uruchom: node tests/kos-store-seed.test.js

const assert = require("assert");
const path = require("path");

// ---- fake Netlify Blobs ----
const storeState = {
  data: null, // null = klucz nigdy nie zapisany
  throwOnGet: false, // true = symulacja braku konfiguracji Blobs
};
const fakeBlobs = {
  getStore: () => ({
    get: async (_key, options) => {
      if (storeState.throwOnGet) {
        throw new Error(
          "MissingBlobsEnvironmentError: The environment has not been configured to use Netlify Blobs."
        );
      }
      // Interfejs @netlify/blobs v10: get(key, { type: "json" })
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

// Świeży handler na każdy scenariusz — resetuje modułowy cache store (cachedStore,
// memoryData) w kos-store.js.
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
  // ---- Scenariusz 1: świeża baza → seed ----
  storeState.data = null;
  storeState.throwOnGet = false;
  const r1 = await get();
  assert.strictEqual(r1.ok, true, "S1: ok=true");
  assert.strictEqual(r1.personal.length, seed.personal.length, "S1: liczba osob z seeda");
  assert.strictEqual(r1.factions.length, seed.factions.length, "S1: liczba klanów z seeda");
  assert.strictEqual(r1.personal[0].name, seed.personal[0].name, "S1: pierwszy cel z seeda");
  assert.deepStrictEqual(storeState.data.personal, seed.personal, "S1: baza zapisana (seeded)");
  console.log("S1 OK — świeża baza zasiana celami z kodu");

  // ---- Scenariusz 2: baza z danymi → bez seeda ----
  storeState.data = { personal: [{ name: "AdminAdded" }], factions: [{ name: "ClanX" }] };
  const r2 = await get();
  assert.strictEqual(r2.ok, true, "S2: ok=true");
  assert.strictEqual(r2.personal[0].name, "AdminAdded", "S2: dane admina zachowane");
  assert.strictEqual(r2.factions[0].name, "ClanX", "S2: dane admina zachowane (factions)");
  assert.strictEqual(r2.personal.length, 1, "S2: seed NIE nadpisał danych");
  console.log("S2 OK — istniejące dane nietknięte, brak re-seedu");

  // ---- Scenariusz 3: pusta ale ZAPISANA baza → brak re-seedu ----
  storeState.data = { personal: [], factions: [] };
  const r3 = await get();
  assert.strictEqual(r3.ok, true, "S3: ok=true");
  assert.strictEqual(r3.personal.length, 0, "S3: pusta lista, NIE wskrzeszamy usuniętych");
  assert.strictEqual(storeState.data.personal.length, 0, "S3: magazyn pozostaje pusty");
  console.log("S3 OK — usunięte cele nie wracają po refresh (klucz istnieje)");

  // ---- Scenariusz 4: Blobs niedostępne → fallback in-memory ----
  storeState.data = null;
  storeState.throwOnGet = true;
  const r4 = await get();
  assert.strictEqual(r4.status, 200, "S4: status 200 (fallback in-memory, nie 503)");
  assert.strictEqual(r4.ok, true, "S4: ok=true");
  assert.strictEqual(r4.personal.length, seed.personal.length, "S4: seed w fallbacku");
  const postRes = await freshHandler()({
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: "x", type: "personal", target: { name: "X" } }),
  });
  // verifyAdmin nie ma tokena → najpierw dostaniemy 403 NO_TOKEN (bezpieczeństwo OK)
  assert.strictEqual(postRes.statusCode, 403, "S4: POST bez tokena = 403 (przed Blobs)");
  console.log("S4 OK — brak Blobs = fallback in-memory, GET działa (200 + seed)");

  storeState.throwOnGet = false;

  console.log("\n✅ WSZYSTKIE TESTY KOS-STORE PRZESZŁY (4/4)");
})().catch((err) => {
  console.error("❌ TEST FAILED:", err.message);
  process.exit(1);
});
