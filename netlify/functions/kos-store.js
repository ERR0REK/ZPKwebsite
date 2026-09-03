// netlify/functions/kos-store.js
// Wspólna baza KOS przechowywana w Netlify Blobs (darmowy magazyn na free planie).
//
// Endpoint: /api/kos-store
//   GET    → zwraca całą listę: { ok: true, personal: [...], factions: [...] }
//   POST   → dodaje/aktualizuje cel  (tylko admin) { access_token, type, target }
//   DELETE → usuwa cel po nazwie     (tylko admin) { access_token, type, name }
//
// Weryfikacja admina: reuse verifyAdmin z ./_lib/discord (rola z Discorda przez bota).
// Dane w magazynie "zpk-kos", pod kluczem "targets", jako jeden obiekt JSON:
//   { personal: [...], factions: [...] }
//
// SEED: przy pierwszym GET (klucz nigdy nie był zapisany) baza jest zasiewana
// celami z ./_lib/kosSeed.json — kopią src/data/kosTargets.json (baza startowa
// z kodu). Dzięki temu świeże wdrożenie od razu pokazuje cele, a admini mogą
// je potem edytować. UWAGA: plik seed trzymaj w sync z src/data/kosTargets.json.
// Usunięcie WSZYSTKICH celów przez admina NIE przywraca seeda (klucz istnieje).
//
// LOKALNY DEV (netlify-cli lambda-local): poświadczenia Blobs przychodzą przez
// event.blobs (baza64 JSON z url+token, ALE bez siteID) — dodajemy mockowe
// "unlinked" (ta sama wartość, której używa netlify-cli dla sandboxa). Gdy Blobs
// w ogóle nie da się skonfigurować (MissingBlobsEnvironmentError), funkcja
// przełącza się na magazyn in-memory — lokalny dev działa end-to-end (seed,
// dodawanie, usuwanie) bez błędów. Produkcja: auto-kontekst z env, bez zmian.

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");
const { resolveStore, getStoreAndData } = require("./_lib/blobStore");

const STORE_NAME = "zpk-kos";
const KEY = "targets";
const MAX_TARGET_SIZE = 50 * 1024; // 50 KB na pojedynczy cel

// Kanał realtime (Ably) — powiadomienia o zmianach w liście KOS.
// Wymaga zmiennej ABLY_API_KEY (klucz ROOT) w panelu Netlify.
const ABLY_CHANNEL = "zpk-kos-updates";
const Ably = require("ably");

// Publikuje informację o zmianie na kanał Ably, żeby wszystkie otwarte
// karty /kos zaktualizowały się natychmiast (live KOS).
// Jeśli Ably nie jest skonfigurowane — cichy fallback (lista i tak działa
// przez odświeżenie / Blobs).
async function publishUpdate(type, action, targetName) {
  if (!process.env.ABLY_API_KEY) return;
  try {
    const client = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
    const channel = client.channels.get(ABLY_CHANNEL);
    await channel.publish("update", {
      type, // 'personal' | 'faction'
      action, // 'added' | 'removed'
      name: targetName,
      timestamp: Date.now()
    });
    client.close();
  } catch (err) {
    console.warn("kos-store ably publish skipped:", err.message);
  }
}

// Normalizuje obiekt celów do stabilnej struktury.
const normalizeTargets = (data) => ({
  _seeded: !!(data && data._seeded),
  personal: data && Array.isArray(data.personal) ? data.personal : [],
  factions: data && Array.isArray(data.factions) ? data.factions : [],
});

// Seed — dane startowe z kodu (fallback gdy Blobs puste)
const kosSeed = normalizeTargets(require("./_lib/kosSeed.json"));

// Otwiera store i zwraca aktualne cele (pusta lista, jeśli nic nie zapisano).
async function getStoreAndTargets(event) {
  const { store, data } = await getStoreAndData(
    event, STORE_NAME, KEY, kosSeed, normalizeTargets
  );
  return { store, targets: data };
}

const upsertTarget = (list, target) => [
  ...list.filter((x) => x.name !== target.name),
  target,
];

// Sanity check celu — chroni magazyn przed śmieciowymi danymi.
const isValidTarget = (target, type) => {
  if (!target || typeof target !== "object") return false;
  if (typeof target.name !== "string" || target.name.trim() === "") return false;
  if (type === "faction" && target.intel && typeof target.intel !== "object") return false;
  return true;
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    // ==================== GET (odczyt dla wszystkich) ====================
    if (event.httpMethod === "GET") {
      const store = await resolveStore(event, STORE_NAME, KEY, kosSeed);
      const data = await store.get(KEY, { type: "json" });
      const cloud = normalizeTargets(data);
      const seed = kosSeed;

      // ZAWSZE scal brakujące cele z seeda z danymi z chmury.
      // Dzięki temu nowe osoby dodane do kosSeed.json (via kod) pojawiają się
      // u wszystkich, nawet gdy _seeded=true (cloud istnieje).
      // Admini mogą USUWAĆ cele (filtr w hiddenList) — scalanie ich nie przywraca.
      const mergedPersonal = [
        ...seed.personal.filter(s => !cloud.personal.some(c => c.name === s.name)),
        ...cloud.personal,
      ];
      const mergedFactions = [
        ...seed.factions.filter(s => !cloud.factions.some(c => c.name === s.name)),
        ...cloud.factions,
      ];

      // Zapisz tylko jeśli doszły nowe cele z seeda
      if (mergedPersonal.length > cloud.personal.length || mergedFactions.length > cloud.factions.length) {
        const merged = { _seeded: true, personal: mergedPersonal, factions: mergedFactions };
        await store.setJSON(KEY, merged);
      }

      return json(200, { ok: true, personal: mergedPersonal, factions: mergedFactions }, {}, event);
    }

    // ============ Zabezpieczenia dla POST / DELETE ============
    // Rate limit — 30 zapytań/min na IP (zmiany KOS są rzadkie)
    const rl = rateLimit(event, 30);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    // ============ POST / DELETE (tylko administratorzy) ============
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (err) {
      return json(400, { ok: false, error: "BAD_JSON" }, {}, event);
    }

    const { access_token, type, name, target } = body;

    // 1. Weryfikacja roli administracyjnej
    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" }, {}, event);
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" }, {}, event);
    }

    if (type !== "personal" && type !== "faction") {
      return json(400, { ok: false, error: "BAD_TYPE" }, {}, event);
    }
    const key = type === "personal" ? "personal" : "factions";

    // 2. DELETE — usuń cel po nazwie
    if (event.httpMethod === "DELETE") {
      if (typeof name !== "string" || name.trim() === "") {
        return json(400, { ok: false, error: "MISSING_NAME" }, {}, event);
      }
      const { store, targets } = await getStoreAndTargets(event);
      targets[key] = targets[key].filter((x) => x.name !== name);
      targets._seeded = true; // oznacz że baza była edytowana
      await store.setJSON(KEY, targets);
      await publishUpdate(type, "removed", name);
      await audit("kos.remove", `${type}: ${name}`, admin.user);
      return json(200, { ok: true, personal: targets.personal, factions: targets.factions }, {}, event);
    }

    // 3. POST — dodaj/aktualizuj cel
    if (event.httpMethod === "POST") {
      if (!isValidTarget(target, type)) {
        return json(400, { ok: false, error: "INVALID_TARGET" }, {}, event);
      }
      const size = Buffer.byteLength(JSON.stringify(target), "utf8");
      if (size > MAX_TARGET_SIZE) {
        return json(413, { ok: false, error: "TARGET_TOO_LARGE" }, {}, event);
      }
      const { store, targets } = await getStoreAndTargets(event);
      targets[key] = upsertTarget(targets[key], target);
      targets._seeded = true; // oznacz że baza była edytowana
      await store.setJSON(KEY, targets);
      await publishUpdate(type, "added", target.name);
      await audit("kos.add", `${type}: ${target.name}`, admin.user);
      return json(200, { ok: true, personal: targets.personal, factions: targets.factions }, {}, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  } catch (err) {
    return handleError(err, "kos-store", event);
  }
};
