// security-fixes-phase2.js
// Phase 2: Strategic Security Fixes for ZPKwebsite (1-4 weeks)

export const meta = {
  name: 'zpk-security-fixes-phase2',
  description: 'Apply strategic security fixes: CSP hardening, idempotency keys, audit log HMAC, session rotation, OAuth PKCE prep',
  phases: [
    { title: 'Strategic Fixes', detail: 'CSP, Idempotency, Audit HMAC, Session Rotation, OAuth PKCE' },
  ]
}

const PROJECT_ROOT = 'D:/pliki/projekty/ZPKwebsite'

// Fix 1: CSP Hardening - remove 'unsafe-inline' and 'unsafe-eval' from netlify.toml
async function fixCSP() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/netlify.toml and find the CSP header configuration.
    The current CSP likely has 'unsafe-inline' and 'unsafe-eval' for scripts/styles.

    Fix: Replace unsafe directives with nonces/hashes approach:
    1. Remove 'unsafe-inline' from script-src and style-src
    2. Remove 'unsafe-eval' from script-src
    3. Add nonce-based CSP for inline scripts (React needs this for dev)
    4. For production, use hashes for inline styles/scripts or move to external files

    Also update the React app to support nonce-based CSP:
    - Add nonce to index.html script tags
    - Configure react-scripts to inject nonce (or use custom CSP meta tag)

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix CSP Hardening',
    phase: 'Strategic Fixes',
    schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              old_str: { type: 'string' },
              new_str: { type: 'string' }
            },
            required: ['file', 'old_str', 'new_str']
          }
        }
      },
      required: ['edits']
    }
  })
  return edits
}

// Fix 2: Idempotency keys for Netlify Blobs writes
async function fixIdempotency() {
  const edits = await agent(`
    Read Netlify Functions that write to Blobs: ${PROJECT_ROOT}/netlify/functions/api/kos-store.js, ${PROJECT_ROOT}/netlify/functions/api/war-store.js, ${PROJECT_ROOT}/netlify/functions/api/announce-store.js, ${PROJECT_ROOT}/netlify/functions/api/upload-evidence.js

    Issue: No idempotency keys - retry storms or double-clicks cause duplicate writes.

    Fix: Add idempotency key support:
    1. Client generates UUID (crypto.randomUUID()) per mutation, sends as 'Idempotency-Key' header
    2. Server stores key + result in Blobs store 'idempotency-keys' with 24h TTL
    3. On duplicate key, return cached response instead of re-executing
    4. Apply to all POST/PUT/DELETE endpoints writing to kos-store, war-store, announce-store

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix Idempotency Keys',
    phase: 'Strategic Fixes',
    schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              old_str: { type: 'string' },
              new_str: { type: 'string' }
            },
            required: ['file', 'old_str', 'new_str']
          }
        }
      },
      required: ['edits']
    }
  })
  return edits
}

// Fix 3: Audit log HMAC integrity
async function fixAuditHMAC() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/netlify/functions/_lib/security.js and any audit logging functions.

    Issue: Audit logs in Netlify Blobs can be tampered with - no integrity verification.

    Fix: Add HMAC-SHA256 signing to audit log entries:
    1. Add AUDIT_HMAC_SECRET to Netlify env vars (32+ byte base64)
    2. Each log entry gets: { ..., hmac: HMAC_SHA256(secret, JSON.stringify(entry)) }
    3. Verification function to validate log integrity on read
    4. Store HMAC secret in Netlify env, not in code

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix Audit HMAC',
    phase: 'Strategic Fixes',
    schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              old_str: { type: 'string' },
              new_str: { type: 'string' }
            },
            required: ['file', 'old_str', 'new_str']
          }
        }
      },
      required: ['edits']
    }
  })
  return edits
}

// Fix 4: Session rotation - shorter TTL, refresh tokens
async function fixSessionRotation() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/src/Context/SessionContext.jsx and ${PROJECT_ROOT}/src/utils/session.js

    Issue: Sessions have 12h TTL with no rotation - token theft = long-lived access.

    Fix: Implement session rotation:
    1. Reduce access token TTL to 15-30 min (handled by Discord OAuth)
    2. Add refresh token flow with secure storage (HttpOnly cookie via Netlify Functions)
    3. Implement automatic token refresh before expiry
    4. Add session invalidation on password change / role change / logout
    5. Track session metadata (IP, UA, created_at) for anomaly detection

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix Session Rotation',
    phase: 'Strategic Fixes',
    schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              old_str: { type: 'string' },
              new_str: { type: 'string' }
            },
            required: ['file', 'old_str', 'new_str']
          }
        }
      },
      required: ['edits']
    }
  })
  return edits
}

// Fix 5: OAuth PKCE preparation - Authorization Code Flow migration
async function fixOAuthPKCE() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/src/Components/Pages/LoginPage.jsx, ${PROJECT_ROOT}/src/Components/Pages/DiscordCallback.jsx, ${PROJECT_ROOT}/src/utils/session.js

    Issue: Discord OAuth uses Implicit Flow (token in URL fragment) - vulnerable to leakage.
    Need to migrate to Authorization Code Flow + PKCE.

    Fix: Prepare PKCE infrastructure:
    1. Add generateCodeVerifier() and generateCodeChallenge() to session.js (RFC 7636)
    2. Update LoginPage to use 'code' response_type with code_challenge + code_challenge_method=S256
    3. Update DiscordCallback to exchange code for token at /api/oauth/token endpoint
    4. Create Netlify Function /api/oauth/token for secure server-side token exchange
    5. Store client secret only in Netlify env, never in frontend

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix OAuth PKCE',
    phase: 'Strategic Fixes',
    schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              old_str: { type: 'string' },
              new_str: { type: 'string' }
            },
            required: ['file', 'old_str', 'new_str']
          }
        }
      },
      required: ['edits']
    }
  })
  return edits
}

// Execute all fixes in parallel
const [cspFix, idempotencyFix, hmacFix, sessionFix, pkceFix] = await parallel([
  fixCSP, fixIdempotency, fixAuditHMAC, fixSessionRotation, fixOAuthPKCE
])

// Apply all edits
const allEdits = [
  ...(cspFix?.edits || []),
  ...(idempotencyFix?.edits || []),
  ...(hmacFix?.edits || []),
  ...(sessionFix?.edits || []),
  ...(pkceFix?.edits || [])
]

log("Total edits to apply: " + allEdits.length)

for (const edit of allEdits) {
  await agent(
    "Apply this edit to " + edit.file + ":\nOLD: " + edit.old_str + "\nNEW: " + edit.new_str,
    { label: "Apply edit to " + edit.file, phase: 'Strategic Fixes' }
  )
}

log('Phase 2 Strategic Fixes complete')