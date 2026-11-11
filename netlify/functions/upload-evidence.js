// netlify/functions/upload-evidence.js
// Upload zdjęcia dowodu przez Catbox.moe (anonimowy hosting - bez konta).
// TYLKO dla administratorów (rola z Discorda) - chroni listę KOS przed trollami.
// Wywołanie: POST /api/upload-evidence
//   Tryb A (plik):  { "access_token": "...", "filename": "dowod.png", "file_base64": "..." }
//   Tryb B (rehost):{ "access_token": "...", "mode": "rehost", "url": "https://cdn.discordapp.com/attachments/..." }
//
// REHOST: linki obrazków z Discorda mają podpis (?ex=...&hm=...) i WYGAJĄ po
// ~24h. Serwer pobiera obraz zanim link umrze i wrzuca go na Catbox —
// w bazie zostaje wieczny link files.catbox.moe zamiast umierającego z Discorda.

const { verifyAdmin, uploadToCatbox, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

// Blokada SSRF: funkcja nie pobiera nic z sieci prywatnych/metadata.
const PRIVATE_HOST_RE =
  /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|\[::1\]|.*\.local$|metadata\.google\.internal)/i;

const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/png": ".png",
};

const rehostFromUrl = async (rawUrl) => {
  let target;
  try {
    target = new URL(rawUrl);
  } catch (e) {
    return { status: 400, body: { ok: false, error: "INVALID_URL" } };
  }
  if (target.protocol !== "https:") {
    return { status: 400, body: { ok: false, error: "INVALID_URL" } };
  }
  if (PRIVATE_HOST_RE.test(target.hostname)) {
    return { status: 400, body: { ok: false, error: "BLOCKED_HOST" } };
  }

  let imgRes;
  try {
    imgRes = await fetch(target.href, {
      headers: { "User-Agent": "ZPK-Site/1.0 (evidence rehost)" },
      redirect: "follow",
    });
  } catch (e) {
    return { status: 502, body: { ok: false, error: "SOURCE_UNREACHABLE" } };
  }
  if (!imgRes.ok) {
    // Typowo: wygasły podpis Discorda → 404
    return {
      status: 502,
      body: { ok: false, error: "SOURCE_UNAVAILABLE", sourceStatus: imgRes.status },
    };
  }

  const ct = (imgRes.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ct.startsWith("image/")) {
    return { status: 415, body: { ok: false, error: "NOT_AN_IMAGE" } };
  }

  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length === 0) {
    return { status: 502, body: { ok: false, error: "SOURCE_EMPTY" } };
  }
  if (buf.length > MAX_BYTES) {
    return { status: 413, body: { ok: false, error: "FILE_TOO_LARGE" } };
  }

  // Nazwa z URL (bez query), z rozszerzeniem z MIME gdy brakuje
  let name = "";
  try {
    name = decodeURIComponent(target.pathname.split("/").pop() || "");
  } catch (e) {
    name = "";
  }
  if (!/\.(png|jpe?g|gif|webp)$/i.test(name)) {
    const stem = (name.replace(/\.[a-z0-9]+$/i, "") || "rehost").slice(0, 80);
    name = stem + (EXT_BY_MIME[ct] || ".png");
  }
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const upload = await uploadToCatbox(safeName, buf.toString("base64"));
  if (!upload.ok) {
    return { status: 502, body: { ok: false, error: upload.error } };
  }
  return { status: 200, body: { ok: true, url: upload.url, original: rawUrl }, safeName };
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    // 204 nie może mieć body — zwracamy sam status + nagłówki CORS.
    // Preflight waliduje origin (allowlista z security.js).
    return {
      statusCode: 204,
      headers: corsHeaders(event),
      body: "",
    };
  }

  try {
    // Rate limit — 15 zapytań/min na IP (uploady są rzadkie i ciężkie)
    const rl = rateLimit(event, 15);
    if (!rl.allowed) {
      return json(429, { ok: false, error: "RATE_LIMITED" }, { "Retry-After": String(rl.retryAfterSec) }, event);
    }

    if (bodyTooLarge(event)) {
      return json(413, { ok: false, error: "BODY_TOO_LARGE" }, {}, event);
    }

    const { access_token, filename, file_base64, mode, url } = JSON.parse(event.body || "{}");

    if (!access_token) {
      return json(400, { ok: false, error: "MISSING_FIELDS" }, {}, event);
    }
    if (mode === "rehost") {
      if (!url) {
        return json(400, { ok: false, error: "MISSING_FIELDS" }, {}, event);
      }
    } else if (!file_base64) {
      return json(400, { ok: false, error: "MISSING_FIELDS" }, {}, event);
    }

    // 1. Weryfikacja roli administracyjnej
    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" }, {}, event);
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" }, {}, event);
    }

    // 2A. REHOST — pobierz źródło i wrzuć na Catbox (wieczny link)
    if (mode === "rehost") {
      const result = await rehostFromUrl(url);
      if (result.status !== 200) {
        return json(result.status, result.body, {}, event);
      }
      await audit("evidence.rehost", result.safeName || "rehost", admin.user);
      return json(200, result.body, {}, event);
    }

    // 2B. UPLOAD PLIKU — limit rozmiaru (Catbox: max 200MB, ale rozsądnie 10MB)
    const sizeBytes = Buffer.from(file_base64, "base64").length;
    if (sizeBytes > MAX_BYTES) {
      return json(413, { ok: false, error: "FILE_TOO_LARGE" }, {}, event);
    }

    // 3. Upload do Catbox
    const safeName = (filename || "dowod.png").replace(/[^a-zA-Z0-9._-]/g, "_");
    const upload = await uploadToCatbox(safeName, file_base64);
    if (!upload.ok) {
      return json(502, { ok: false, error: upload.error }, {}, event);
    }

    await audit("evidence.upload", safeName, admin.user);

    return json(200, { ok: true, url: upload.url }, {}, event);
  } catch (err) {
    return handleError(err, "upload-evidence", event);
  }
};
