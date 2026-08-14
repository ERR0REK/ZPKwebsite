// netlify/functions/upload-evidence.js
// Upload zdjęcia dowodu przez Catbox.moe (anonimowy hosting - bez konta).
// TYLKO dla administratorów (rola z Discorda) - chroni listę KOS przed trollami.
// Wywołanie: POST /api/upload-evidence
//   { "access_token": "...", "filename": "dowod.png", "file_base64": "..." }

const { verifyAdmin, uploadToCatbox, json, corsHeaders } = require("./_lib/discord");
const { rateLimit, bodyTooLarge, audit, handleError } = require("./_lib/security");

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

    const { access_token, filename, file_base64 } = JSON.parse(event.body || "{}");

    if (!access_token || !file_base64) {
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

    // 2. Limit rozmiaru (Catbox: max 200MB, ale rozsądnie 10MB)
    const sizeBytes = Buffer.from(file_base64, "base64").length;
    if (sizeBytes > 10 * 1024 * 1024) {
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
