// netlify/functions/health.js
// Endpoint zdrowia: GET /api/health
//
// Do monitoringu (UptimeRobot / curl / bot) — NIE używa go frontend.
// Pinguje każdy store Netlify Blobs używany przez funkcje i raportuje:
//   - status per-store (czytelność = store osiągalny),
//   - kontekst deploya (production / branch-deploy / ...),
//   - czy ABLY_API_KEY jest skonfigurowany (LIVE vs STANDBY na froncie).
//
// Odpowiedzi: 200 gdy wszystko działa, 503 gdy którykolwiek store padł —
// dzięki temu zewnętrzny monitor potrafi odróżnić "strona działa" od "awaria".
// Bez rate limitu celowo: to tani GET (parę odczytów), a monitory nie mogą
// dostać 429 (uznaliby awarię).

const { json, corsHeaders } = require("./_lib/discord");
const { handleError } = require("./_lib/security");
const { getStoreOptions } = require("./_lib/blobStore");
const { getStore } = require("@netlify/blobs");

// Wszystkie store'y, z których korzystają funkcje.
// Ping = odczyt klucza (brak wpisu zwraca null — to nadal "store działa").
const STORES = [
  { name: "zpk-kos", key: "targets" },
  { name: "zpk-war-logs", key: "logs" },
  { name: "zpk-announce", key: "history" },
  { name: "zpk-audit", key: "actions" },
];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(event), body: "" };
  }

  try {
    const started = Date.now();
    const blobs = { ok: true, stores: [] };
    let anyFail = false;

    for (const { name, key } of STORES) {
      const entry = { name, ok: false };
      try {
        const store = getStore(name, getStoreOptions(event));
        await store.get(key, { type: "json", consistency: "strong" });
        entry.ok = true;
      } catch (err) {
        entry.error = String((err && err.message) || err).slice(0, 150);
        anyFail = true;
      }
      blobs.stores.push(entry);
    }
    blobs.ok = !anyFail;

    // Informacje o deployu — tylko te, które Netlify faktycznie udostępni.
    const env = (key) => (process.env[key] ? process.env[key] : undefined);

    const payload = {
      ok: !anyFail,
      service: "zpkwebsite-api",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - started,
      deploy: {
        context: env("CONTEXT") || "unknown",
        branch: env("BRANCH") || undefined,
        commitRef: env("COMMIT_REF") || undefined,
        deployId: env("DEPLOY_ID") || undefined,
      },
      runtime: {
        node: process.version,
      },
      ablyConfigured: !!env("ABLY_API_KEY"),
      blobs,
    };

    return json(anyFail ? 503 : 200, payload, {}, event);
  } catch (err) {
    return handleError(err, "health", event);
  }
};
