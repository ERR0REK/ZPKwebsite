// security-fixes-phase1.js
// Phase 1: Critical Security Fixes for ZPKwebsite

export const meta = {
  name: 'zpk-security-fixes-phase1',
  description: 'Apply critical security fixes: XSS, OAuth PKCE prep, Math.random, timeouts, geo-block, env vars',
  phases: [
    { title: 'Critical Fixes', detail: 'XSS, OAuth PKCE, Math.random fallback' },
  ]
}

const PROJECT_ROOT = 'D:/pliki/projekty/ZPKwebsite'

// Fix 1: XSS in parseEvidenceLines - KOS.jsx
async function fixXSS() {
  const edits = await agent(`
    Read the file ${PROJECT_ROOT}/src/Components/Pages/KOS.jsx lines 117-132 and 607-641.
    The parseEvidenceLines function parses user-controlled evidence strings and renders them directly in <a href={ev.url}> without sanitization.
    Evidence format: "type|url|title" - url and title are user-controlled.
    Attack vector: discord|javascript:alert(1)|XSS renders as <a href="javascript:alert(1)">XSS</a>

    Fix needed:
    1. In parseEvidenceLines: validate URL scheme (only https: allowed for discord/other/medal/youtube), sanitize title
    2. In renderEvidenceStrip and renderEvidenceSection: validate ev.url starts with https://, sanitize ev.title
    3. Add DOMPurify import if not present (npm install dompurify)

    Return the exact old_string/new_string edits needed as JSON array.
  `, {
    label: 'Fix XSS parseEvidenceLines',
    phase: 'Critical Fixes',
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

// Fix 2: Math.random() fallback in session.js
async function fixMathRandom() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/src/utils/session.js lines 99-110.
    generateOAuthState() has a fallback using Math.random() when crypto.getRandomValues unavailable.
    This is predictable and enables CSRF on OAuth flow.

    Fix: Remove the fallback entirely. Require crypto.getRandomValues (supported in all target browsers). Throw clear error if unavailable.

    Return exact old_string/new_string edit as JSON array.
  `, {
    label: 'Fix Math.random fallback',
    phase: 'Critical Fixes',
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

// Fix 3: Add fetch timeouts to Discord API calls
async function fixDiscordTimeouts() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/netlify/functions/_lib/discord.js lines 104-116 and 156-169.
    fetch() calls to Discord API have no timeout. Vulnerable to slowloris DoS.

    Fix: Wrap all fetch calls with AbortController 5s timeout.
    Pattern:
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = fetch(url, { signal: controller.signal, ... })
    } finally { clearTimeout(timeout) }

    Apply to all fetch calls in this file (getGuildMember, getUserGuilds, verifyAdminRole, etc.)

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix Discord fetch timeouts',
    phase: 'Critical Fixes',
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

// Fix 4: Geo-block fail-open and bot UA spoofing
async function fixGeoBlock() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/netlify/edge-functions/geo-block.js lines 125-128, 156-160, 162-163.
    Issues:
    1. Line 156-160: if (!country) return context.next() - fail-open, VPN bypass
    2. Line 125-128: isIndexingBot() checks User-Agent for Googlebot etc - spoofable
    3. Line 162-163: bot check allows bypass

    Fixes:
    1. Change to fail-closed for production: if (!country) return new Response(BLOCK_PAGE_HTML, {status: 451, headers: {'Content-Type': 'text/html'}})
    2. Remove UA-based bot allowlist entirely. Use Netlify's built-in bot detection or log UA mismatches.
    3. Add CONTEXT=dev check for fail-open only in dev.

    Return exact old_string/new_string edits as JSON array.
  `, {
    label: 'Fix geo-block',
    phase: 'Critical Fixes',
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

// Fix 5: Move hardcoded IDs to env vars
async function fixHardcodedIDs() {
  const edits = await agent(`
    Read ${PROJECT_ROOT}/netlify/functions/_lib/discord.js lines 21-45.
    Hardcoded: DEFAULT_GUILD_ID, DEFAULT_ADMIN_ROLES (8 role IDs), DEFAULT_MEMBER_ROLES.
    These should be in Netlify Environment Variables only.

    Fix:
    1. Remove all DEFAULT_ constants
    2. Read from process.env.ZPK_GUILD_IDS, process.env.ZPK_ADMIN_ROLE_IDS, process.env.ZPK_MEMBER_ROLE_IDS
    3. Add validation: throw at module load if required env vars missing
    4. Format: guildId:roleId,guildId:roleId (as already used in verify-admin.js)

    Return exact old_string/new_string edit as JSON array.
  `, {
    label: 'Fix hardcoded IDs',
    phase: 'Critical Fixes',
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
const [xssFix, mathRandomFix, timeoutFix, geoBlockFix, envVarsFix] = await parallel([
  fixXSS, fixMathRandom, fixDiscordTimeouts, fixGeoBlock, fixHardcodedIDs
])

// Apply all edits
const allEdits = [
  ...(xssFix?.edits || []),
  ...(mathRandomFix?.edits || []),
  ...(timeoutFix?.edits || []),
  ...(geoBlockFix?.edits || []),
  ...(envVarsFix?.edits || [])
]

log(`Total edits to apply: ${allEdits.length}`)

for (const edit of allEdits) {
  await agent(`
    Apply this edit to ${edit.file}:
    OLD: ${edit.old_str}
    NEW: ${edit.new_str}
  `, { label: `Apply edit to ${edit.file}`, phase: 'Critical Fixes' })
}

log('✅ Phase 1 Critical Fixes complete')