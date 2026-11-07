// netlify/functions/_lib/security.js
// Wspólne zabezpieczenia dla funkcji Netlify.
//
// Zawiera:
//   1. CORS — tylko dozwolone domeny (zamiast "*")
//   2. Rate limiting — limit zapytań na IP (in-memory, best-effort)
//   3. Limit rozmiaru body
//   4. Audit log — zapis działań adminów do Netlify Blobs
//   5. Bezpieczne komunikaty błędów (zero stack trace'ów w odpowiedziach)

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

// ============================================================
// 1. CORS — tylko dozwolone domeny
// ============================================================

// Domena, na której działa funkcja (z nagłówka Host) + allowlista origins.
// Origin "*" jest zabroniony — obca strona nie może wywołać naszych funkcji.
const ALLOWED_ORIGINS = [
  "https://zpk.netlify.app",
  "https://dev-zpkwebsite.netlify.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3006",
  "http://localhost:3007",
  "http://localhost:3008",
  "http://localhost:3009",
];

function corsHeaders(event) {
  const origin = (event && event.headers && event.headers.origin) || "";
  // Bez nagłówka Origin (np. OPTIONS preflight, curl, same-origin fetch)
  // zwracamy "*" — przeglądarka i tak wymusi CORS dla cross-origin.
  const allowed = !origin ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
    "Vary": "Origin",
  };
}

// ============================================================
// 2. Rate limiting — limit zapytań na IP
// ============================================================
// Funkcje serverless są efemeryczne — limit działa w obrębie "ciepłej"
// instancji. To ochrona "najlepszej starań" przed spamem, nie twardy
// firewall. Wystarcza, żeby odstraszyć skrypty brute-force.

const RATE_WINDOW_MS = 60 * 1000; // okno 60 s
const rateBuckets = new Map(); // ip -> { count, windowStart }

// Zwraca { allowed: true } albo { allowed: false, retryAfterSec }
function rateLimit(event, maxRequestsPerMinute = 60) {
  const ip = (event && event.headers && (event.headers["x-forwarded-for"] || ""))
    .split(",")[0]
    .trim() || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, windowStart: now };

  if (now - bucket.windowStart > RATE_WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  bucket.count += 1;
  rateBuckets.set(ip, bucket);

  if (bucket.count > maxRequestsPerMinute) {
    const retryAfterSec = Math.ceil((bucket.windowStart + RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

// ============================================================
// 3. Limit rozmiaru body
// ============================================================

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

function bodyTooLarge(event, maxBytes = MAX_BODY_BYTES) {
  const raw = event.body || "";
  return Buffer.byteLength(raw, "utf8") > maxBytes;
}

// ============================================================
// 4. Audit log — zapis działań adminów do Blobs
// ============================================================

const AUDIT_STORE = "zpk-audit";
const AUDIT_KEY = "actions";
const AUDIT_LIMIT = 100; // trzymamy ostatnie 100 akcji

// HMAC secret for audit log integrity (32+ bytes base64, set in Netlify env vars)
function getAuditHmacSecret() {
  const secret = process.env.AUDIT_HMAC_SECRET;
  if (!secret) {
    throw new Error("AUDIT_HMAC_SECRET not configured in environment");
  }
  const buf = Buffer.from(secret, "base64");
  if (buf.length < 32) {
    throw new Error("AUDIT_HMAC_SECRET must be at least 32 bytes (base64 decoded)");
  }
  return buf;
}

// Generate HMAC-SHA256 for an audit entry
function signAuditEntry(entry) {
  const secret = getAuditHmacSecret();
  // Create a deterministic string representation (exclude hmac field if present)
  const { hmac, ...entryWithoutHmac } = entry;
  const payload = JSON.stringify(entryWithoutHmac, Object.keys(entryWithoutHmac).sort());
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

// Verify HMAC-SHA256 of an audit entry
function verifyAuditEntry(entry) {
  if (!entry.hmac) return false;
  const expectedHmac = signAuditEntry(entry);
  // Constant-time comparison
  return crypto.timingSafeEqual(Buffer.from(entry.hmac), Buffer.from(expectedHmac));
}

// Verify integrity of entire audit log
async function verifyAuditLog() {
  try {
    const store = getStore({ name: AUDIT_STORE, consistency: "strong" });
    const history = await store.get(AUDIT_KEY, { type: "json", consistency: "strong" });
    if (!Array.isArray(history)) return { valid: true, entries: [] };
    const results = history.map((entry, idx) => ({
      index: idx,
      valid: verifyAuditEntry(entry),
      entry,
    }));
    return {
      valid: results.every((r) => r.valid),
      entries: results,
    };
  } catch (err) {
    console.warn("audit log verification failed:", err.message);
    return { valid: false, entries: [], error: err.message };
  }
}

// adminInfo: { id, username } (z verifyAdmin)
async function audit(action, detail, adminInfo = {}) {
  try {
    const store = getStore({ name: AUDIT_STORE, consistency: "strong" });
    const existing = await store.get(AUDIT_KEY, { type: "json", consistency: "strong" });
    const history = Array.isArray(existing) ? existing : [];
    const entry = {
      at: new Date().toISOString(),
      action,
      detail: String(detail || "").slice(0, 200),
      admin_id: adminInfo.id || "unknown",
      admin_username: adminInfo.username || "unknown",
    };
    // Sign the entry with HMAC for integrity
    entry.hmac = signAuditEntry(entry);
    await store.setJSON(AUDIT_KEY, [entry, ...history].slice(0, AUDIT_LIMIT));
  } catch (err) {
    // Audit to bonus — nie może wywalić głównej akcji.
    console.warn("audit log skipped:", err.message);
  }
}

// ============================================================
// 5. Bezpieczne błędy — zero stack trace'ów w odpowiedziach
// ============================================================

// Loguje pełny błąd na serwerze, ale do odpowiedzi zwraca generyczny kod.
// event opcjonalny — CORS z allowlisty, gdy znamy origin.
function handleError(err, context, event) {
  console.error(`${context} error:`, err && err.message ? err.message : err);
  return {
    statusCode: 500,
    headers: corsHeaders(event),
    body: JSON.stringify({ ok: false, error: "SERVER_ERROR" }),
  };
}

module.exports = {
  corsHeaders,
  rateLimit,
  bodyTooLarge,
  audit,
  handleError,
  ALLOWED_ORIGINS,
  signAuditEntry,
  verifyAuditEntry,
  verifyAuditLog,
};
