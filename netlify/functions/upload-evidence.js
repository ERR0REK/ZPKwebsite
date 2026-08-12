// netlify/functions/upload-evidence.js
// Upload zdjęcia dowodu przez Catbox.moe (anonimowy hosting - bez konta).
// TYLKO dla administratorów (rola z Discorda) - chroni listę KOS przed trollami.
// Wywołanie: POST /api/upload-evidence
//   { "access_token": "...", "filename": "dowod.png", "file_base64": "..." }

const { verifyAdmin, uploadToCatbox, json, corsHeaders } = require("./_lib/discord");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    // 204 nie może mieć body — zwracamy sam status + nagłówki CORS
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: "",
    };
  }

  try {
    const { access_token, filename, file_base64 } = JSON.parse(event.body || "{}");

    if (!access_token || !file_base64) {
      return json(400, { ok: false, error: "MISSING_FIELDS" });
    }

    // 1. Weryfikacja roli administracyjnej
    const admin = await verifyAdmin(access_token);
    if (!admin.ok) {
      return json(403, { ok: false, error: admin.error || "ADMIN_CHECK_FAILED" });
    }
    if (!admin.is_admin) {
      return json(403, { ok: false, error: "FORBIDDEN_NOT_ADMIN" });
    }

    // 2. Limit rozmiaru (Catbox: max 200MB, ale rozsądnie 10MB)
    const sizeBytes = Buffer.from(file_base64, "base64").length;
    if (sizeBytes > 10 * 1024 * 1024) {
      return json(413, { ok: false, error: "FILE_TOO_LARGE" });
    }

    // 3. Upload do Catbox
    const safeName = (filename || "dowod.png").replace(/[^a-zA-Z0-9._-]/g, "_");
    const upload = await uploadToCatbox(safeName, file_base64);
    if (!upload.ok) {
      return json(502, { ok: false, error: upload.error });
    }

    return json(200, { ok: true, url: upload.url });
  } catch (err) {
    console.error("upload-evidence error:", err);
    return json(500, { ok: false, error: "SERVER_ERROR" });
  }
};
