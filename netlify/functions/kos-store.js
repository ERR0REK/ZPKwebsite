// netlify/functions/kos-store.js
// Wspólna baza KOS przechowywana w Netlify Blobs (darmowy magazyn na free planie).
//
// Endpoint: /api/kos-store
//   GET    → zwraca całą listę: { ok: true, personal: [...], factions: [...] }
//   POST   → dodaje/aktualizuje cel  (tylko admin) { access_token, type, target }
//   DELETE → usuwa cel po nazwie     (tylko admin) { access_token, type, name }
//
// Weryfikacja admina: reuse verifyAdmin z ./_lib/discord (rola z Discorda przez bota).
//
// STORAGE (redesign: jeden wpis = jeden blob):
//   Każdy cel to osobny blob w store "zpk-kos":
//     targets/personal/<nazwa>   (encodeURIComponent)
//     targets/faction/<nazwa>
//   Mutacje są atomiczne (onlyIfMatch / onlyIfNew na ETagu wpisu) — dwóch
//   adminów naraz nie nadpisuje sobie nawzajem całej listy (last-write-wins).
//
// MIGRACJA: stary pojedynczy klucz "targets" ({ personal, factions } w jednym
// JSON) jest przy pierwszym GET rozbijany na wpisy i usuwany (idempotentnie).
//
// SEED: kosSeed.json trafia do magazynu TYLKO przy pierwszym uruchomieniu
// (marker _meta/seeded) — skasowany cel NIE wraca po odświeżeniu.
// UWAGA: plik seed trzymaj w sync z src/data/kosTargets.json.
//
// LOKALNY DEV (netlify-cli lambda-local): poświadczenia Blobs przychodzą przez
// event.blobs (baza64 JSON z url+token, ALE bez siteID) — dodajemy mockowe
// "unlinked" (ta sama wartość, której używa netlify-cli dla sandboxa). Gdy Blobs
// w ogóle nie da się skonfigurować (MissingBlobsEnvironmentError), funkcja
// przełącza się na magazyn in-memory — lokalny dev działa end-to-end (seed,
// dodawanie, usuwanie) bez błędów. Produkcja: auto-kontekst z env, bez zmian.

const { verifyAdmin, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");
const {
  resolveStore,
  readEntryStore,
  readEntry,
  writeEntry,
  removeEntry,
} = require("./_lib/blobStore");
const { publish } = require("./_lib/ably");

const STORE_NAME = "zpk-kos";
const LEGACY_KEY = "targets"; // stary pojedynczy klucz (migracja)
const PREFIX = "targets/"; // prefiks wpisów
const MAX_TARGET_SIZE = 50 * 1024; // 50 KB na pojedynczy cel

// Kanał realtime (Ably) — powiadomienia o zmianach w liście KOS.
// Wymaga zmiennej ABLY_API_KEY (klucz ROOT) w panelu Netlify.
const ABLY_CHANNEL = "zpk-kos-updates";

// Publikuje informację o zmianie na kanał Ably, żeby wszystkie otwarte
// karty /kos zaktualizowały się natychmiast (live KOS).
// Adapter nigdy nie rzuca — brak Ably to cichy fallback (lista i tak działa
// przez odświeżenie / Blobs).
const publishUpdate = (type, action, targetName) =>
  publish(ABLY_CHANNEL, "update", {
    type, // 'personal' | 'faction'
    action, // 'added' | 'removed'
    name: targetName,
    timestamp: Date.now()
  });

// Seed — dane startowe z kodu (fallback gdy Blobs puste)
const kosSeed = require("./_lib/kosSeed.json");

// Klucz wpisu dla celu — prefiks niesie typ, nazwa jest URL-encoded,
// żeby "/" w nazwie nie tworzyło zagnieżdżonych katalogów.
const entryKey = (type, name) => `${PREFIX}${type}/${encodeURIComponent(name)}`;

// Wspólne mapowanie dokumentu { personal, factions } → wpisy.
// Używane zarówno przez migrację legacy, jak i seed.
const kosToEntries = (doc) => [
  ...(doc && Array.isArray(doc.personal) ? doc.personal : []).map((t) => ({
    key: entryKey("personal", t.name),
    data: t,
  })),
  ...(doc && Array.isArray(doc.factions) ? doc.factions : []).map((t) => ({
    key: entryKey("faction", t.name),
    data: t,
  })),
];

// Definicja entry-store'a KOS (rejestr w blobStore)
const KOS_ENTRIES = {
  storeName: STORE_NAME,
  prefix: PREFIX,
  legacyKey: LEGACY_KEY,
  seed: kosSeed,
  toEntries: kosToEntries,
};

// Składa wpisy w odpowiedź API — grupa po typie (z klucza), posortowane po nazwie.
const groupTargets = (entries) => {
  const personal = [];
  const factions = [];
  for (const e of entries) {
    if (e.key.startsWith(`${PREFIX}personal/`)) personal.push(e.data);
    else if (e.key.startsWith(`${PREFIX}faction/`)) factions.push(e.data);
  }
  const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
  return { personal: personal.sort(byName), factions: factions.sort(byName) };
};

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
      const { entries } = await readEntryStore(event, KOS_ENTRIES);
      return json(200, { ok: true, ...groupTargets(entries) }, {}, event);
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

    // 2. DELETE — usuń cel po nazwie
    if (event.httpMethod === "DELETE") {
      if (typeof name !== "string" || name.trim() === "") {
        return json(400, { ok: false, error: "MISSING_NAME" }, {}, event);
      }
      const store = await resolveStore(event, STORE_NAME, LEGACY_KEY, kosSeed);
      const key = entryKey(type, name);
      const existing = await readEntry(store, key);
      if (!existing) {
        return json(404, { ok: false, error: "NOT_FOUND" }, {}, event);
      }
      await removeEntry(store, key);
      await publishUpdate(type, "removed", name);
      await audit("kos.remove", `${type}: ${name}`, admin.user);

      // Świeży snapshot — odfiltruj skasowany wpis (list może go jeszcze
      // pokazywać przez chwilę przy eventual consistency edge'ów).
      const { entries } = await readEntryStore(event, KOS_ENTRIES);
      return json(200, { ok: true, ...groupTargets(entries.filter((e) => e.key !== key)) }, {}, event);
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
      const store = await resolveStore(event, STORE_NAME, LEGACY_KEY, kosSeed);
      const key = entryKey(type, target.name);

      // Atomiczny zapis: nowy wpis → onlyIfNew; istniejący → onlyIfMatch (etag).
      // Jeśli wpis zmienił się między odczytem a zapisem (drugi admin),
      // onlyIfMatch zwróci modified:false → 409 zamiast cichego nadpisania.
      let res = await writeEntry(store, key, target, { onlyIfNew: true });
      if (!res.modified) {
        const existing = await readEntry(store, key);
        if (existing) {
          res = await writeEntry(store, key, target, { onlyIfMatch: existing.etag });
        } else {
          res = await writeEntry(store, key, target, { onlyIfNew: true });
        }
      }
      if (!res.modified) {
        return json(409, { ok: false, error: "CONFLICT" }, {}, event);
      }

      await publishUpdate(type, "added", target.name);
      await audit("kos.add", `${type}: ${target.name}`, admin.user);

      const { entries } = await readEntryStore(event, KOS_ENTRIES);
      return json(200, { ok: true, ...groupTargets(entries) }, {}, event);
    }

    return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" }, {}, event);
  } catch (err) {
    return handleError(err, "kos-store", event);
  }
};