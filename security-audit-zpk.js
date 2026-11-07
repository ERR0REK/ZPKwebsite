// security-audit-zpk.js
// Workflow do pełnego audytu bezpieczeństwa ZPKwebsite
// Uruchom: Workflow({scriptPath: "D:/pliki/projekty/ZPKwebsite/security-audit-zpk.js"})

export const meta = {
  name: 'zpk-security-audit',
  description: 'Full security audit for ZPKwebsite (React + Netlify + Discord OAuth + Ably + Netlify Blobs)',
  phases: [
    { title: 'Static Analysis', detail: 'CodeQL + Semgrep on src/' },
    { title: 'Supply Chain', detail: 'npm dependencies audit' },
    { title: 'Infra Config', detail: 'netlify.toml + functions audit' },
    { title: 'Auth Flow', detail: 'Discord OAuth + device-code phishing test' },
    { title: 'Cloud Storage', detail: 'Netlify Blobs access patterns' },
    { title: 'Recon', detail: 'Typosquatting + CT logs monitoring' },
    { title: 'I18n Audit', detail: 'en.json + pl.json validation' },
    { title: 'E2E Testing', detail: 'Playwright tests for KOS/WarLogs/AuthGuard' },
    { title: 'Log Analysis', detail: 'Netlify Functions intrusion detection' },
    { title: 'Synthesis', detail: 'Combine findings into report' },
  ],
}

// Helper: run a skill as subagent
async function runSkill(skillPath, prompt, label) {
  return agent(prompt, {
    label,
    phase: label,
    schema: {
      type: 'object',
      properties: {
        findings: { type: 'array', items: { type: 'object' } },
        summary: { type: 'string' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] }
      },
      required: ['findings', 'summary', 'severity']
    }
  })
}

phase('Static Analysis')
const staticAnalysis = await runSkill(
  'trailofbits/static-analysis',
  `Run comprehensive static analysis on ZPKwebsite React 19 codebase at D:/pliki/projekty/ZPKwebsite/src.
   Focus on:
   - React hooks violations (exhaustive-deps, stale closures)
   - XSS vectors in evidence.js (parseEvidenceLines, rehostEvidenceText)
   - Path traversal in upload-evidence function
   - Auth bypass in AuthGuard/DevGuard/SessionContext
   - Insecure random in session tokens
   - CSP bypass via inline styles/scripts
   Use CodeQL + Semgrep. Return SARIF-compatible findings.`,
  'Static Analysis'
)

phase('Supply Chain')
const supplyChain = await runSkill(
  'trailofbits/supply-chain-risk-auditor',
  `Audit npm dependencies for ZPKwebsite at D:/pliki/projekty/ZPKwebsite/package.json.
   Check 114k+ files in node_modules for:
   - Abandoned/unmaintained packages
   - Install scripts (preinstall, postinstall)
   - Version-matched CVEs (GHSA, CVE)
   - Publisher concentration risk
   - Typosquatted package names
   - License compliance (GPL in MIT project)
   Focus on: react-scripts, ably, axios, framer-motion, i18next, lucide-react, @netlify/blobs`,
  'Supply Chain'
)

phase('Infra Config')
const infraConfig = await runSkill(
  'mukul-cybersec/auditing-terraform-infrastructure-for-security',
  `Audit Netlify infrastructure config for ZPKwebsite:
   - netlify.toml: redirects, headers, build plugins, functions config
   - Netlify Functions: /api/kos-store, /api/war-store, /api/verify-admin, /api/ably-token-request, /api/upload-evidence
   - CORS policies, CSP headers, HSTS, X-Frame-Options
   - Environment variables exposure (ABLY_API_KEY, DISCORD_CLIENT_SECRET, etc.)
   - Build plugins security
   - Edge functions vs regular functions
   Return misconfigurations with severity.`,
  'Infra Config'
)

phase('Auth Flow')
const authFlow = await runSkill(
  'mukul-cybersec/attacking-oauth-with-device-code-phishing',
  `Test Discord OAuth 2.0 flow for ZPKwebsite:
   - Authorization endpoint: https://discord.com/oauth2/authorize
   - Token endpoint: https://discord.com/api/oauth2/token
   - Client ID from env: DISCORD_CLIENT_ID
   - Redirect URI: https://zpkwebsite.netlify.app/auth/callback
   - Scopes: identify, guilds.members.read
   Test for:
   1. CSRF via missing/weak state nonce (check LoginPage.jsx, DiscordCallback.jsx)
   2. PKCE bypass (code_verifier/code_challenge)
   3. Token replay attacks
   4. Device code flow phishing (if enabled)
   5. Session fixation (12h TTL in SessionContext)
   6. Role verification bypass (/api/verify-admin)
   7. DevGuard vs AuthGuard differences
   Return attack vectors with PoC steps.`,
  'Auth Flow'
)

phase('Cloud Storage')
const cloudStorage = await runSkill(
  'mukul-cybersec/analyzing-cloud-storage-access-patterns',
  `Analyze Netlify Blobs access patterns for ZPKwebsite:
   Stores: kos-store, war-store, announce-store, announce-history-store
   Channels: zpk-kos-updates, zpk-war-status, zpk-announcements
   Detect anomalies:
   - Mass enumeration of KOS targets (personal + faction)
   - War logs exfiltration (member KD, enemy KD, MVP data)
   - Admin panel access without admin role
   - Realtime subscription abuse (Ably token reuse)
   - Seed data pollution (kosTargets.json, warLogs.json injection)
   - Hidden names list manipulation (STORAGE_HIDDEN)
   - Cross-store data correlation
   Return detection rules + anomaly thresholds.`,
  'Cloud Storage'
)

phase('Recon')
const recon = await parallel([
  () => runSkill(
    'mukul-cybersec/analyzing-typosquatting-domains-with-dnstwist',
    `Generate and analyze typosquat domains for zpkwebsite.netlify.app and nightfallsquadron.pl.
     Check: permutations, homoglyphs, TLD variations, subdomain takeover.
     Monitor Certificate Transparency logs for rogue certs.`,
    'Typosquatting'
  ),
  () => runSkill(
    'mukul-cybersec/auditing-tls-certificate-transparency-logs',
    `Monitor CT logs for certificates issued for:
     - *.netlify.app (zpkwebsite, dev-zpkwebsite)
     - nightfallsquadron.pl (if custom domain)
     - discord.gg/A3wE5mGryB (phishing lookalikes)
     Alert on: unauthorized CA, wildcard certs, short validity.`,
    'CT Logs'
  ),
])

phase('I18n Audit')
const i18nAudit = await runSkill(
  'alireza-skills/engineering/i18n-localization',
  `Audit i18n files for ZPKwebsite at D:/pliki/projekty/ZPKwebsite/src/Locales:
   - en.json (1600+ lines) + pl.json
   - Find missing keys, broken placeholders ({{count}}, {{name}})
   - Duplicate strings, inconsistent formatting
   - Security-sensitive strings exposed (error messages, stack traces)
   - Hardcoded strings in JSX not in locales
   - Namespace collisions (changelog.dev[].changes[].title vs changelog.release[])
   Return missing keys report + security exposure list.`,
  'I18n Audit'
)

phase('E2E Testing')
const e2eTesting = await runSkill(
  'alireza-skills/engineering-team/playwright-pro',
  `Create Playwright E2E tests for ZPKwebsite critical paths:
   1. Auth flow: LoginPage -> DiscordCallback -> SessionContext -> AuthGuard -> KOS page
   2. KOS: search, filter, sort, dossier modal, evidence view, admin panel (add/remove/rehost)
   3. War Logs: search, filter by result, modal tabs (info/enemyKD/memberKD), admin add/remove
   4. Realtime: Ably connection (LIVE/STANDBY), ActivityFeed updates
   5. DevGuard: dev site access with/without dev session
   6. SecurityLayer: F12/right-click block in production
   7. Language selector: vertical scroll, translate link forces English
   Run against https://zpkwebsite.netlify.app and local netlify dev.`,
  'E2E Testing'
)

phase('Log Analysis')
const logAnalysis = await runSkill(
  'mukul-cybersec/analyzing-web-server-logs-for-intrusion',
  `Analyze Netlify Functions logs for intrusion attempts:
   Endpoints: /api/kos-store (GET/POST/DELETE), /api/war-store, /api/verify-admin, /api/ably-token-request, /api/upload-evidence
   Detect:
   - AuthGuard bypass attempts (missing/invalid session)
   - Admin panel access without admin role
   - KOS target enumeration (sequential name guessing)
   - Evidence upload abuse (large files, non-image types)
   - Discord token replay in verify-admin
   - Ably token request rate anomalies
   - IP reputation (VPN, Tor, known attackers)
   - Time-based patterns (off-hours access)
   Return detection rules + suspicious IPs.`,
  'Log Analysis'
)

phase('Synthesis')
const allFindings = [
  staticAnalysis, supplyChain, infraConfig, authFlow, cloudStorage,
  ...recon.filter(Boolean), i18nAudit, e2eTesting, logAnalysis
].filter(Boolean)

const synthesis = await agent(`
  Synthesize all security findings for ZPKwebsite into executive report.

  Findings by phase:
  ${JSON.stringify(allFindings.map(f => ({ phase: f.label || 'unknown', severity: f.severity, count: f.findings?.length, summary: f.summary })), null, 2)}

  Produce:
  1. Executive summary (3 bullets)
  2. Top 10 critical/high findings with file:line, PoC, fix
  3. Supply chain vulnerabilities table
  4. Auth flow attack tree
  5. Netlify Blobs threat model
  6. Remediation priority (quick wins vs strategic)
  7. Compliance gaps (GDPR, Polish law, Discord ToS)

  Format as Markdown for SKILLS_AUDIT_REPORT.md
`, {
  label: 'Synthesis',
  phase: 'Synthesis',
  schema: {
    type: 'object',
    properties: {
      report: { type: 'string' }
    },
    required: ['report']
  }
})

// Write final report
await agent(`
  Write the following report to D:/pliki/projekty/ZPKwebsite/SECURITY_AUDIT_REPORT.md:
  ${synthesis.report}
`, {
  label: 'Write Report',
  phase: 'Synthesis'
})

log('✅ Security audit complete. Report at SECURITY_AUDIT_REPORT.md')