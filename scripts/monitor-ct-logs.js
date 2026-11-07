#!/usr/bin/env node
/**
 * CT Log Monitor for ZPK Website
 * Monitors Certificate Transparency logs for:
 * - *.netlify.app (zpkwebsite, dev-zpkwebsite)
 * - nightfallsquadron.pl (custom domain)
 * - discord.gg/A3wE5mGryB (phishing lookalikes)
 * Alerts on: unauthorized CA, wildcard certs, short validity
 */

const https = require('https');
const { URL } = require('url');

// Configuration
const CONFIG = {
  domains: [
    'zpkwebsite.netlify.app',
    'dev-zpkwebsite.netlify.app',
    'nightfallsquadron.pl',
    'discord.gg'
  ],
  // Known authorized CAs for these domains
  authorizedCAs: [
    'Let\'s Encrypt',
    'DigiCert',
    'GlobalSign',
    'Sectigo',
    'Google Trust Services',
    'Cloudflare',
    'Netlify',
    'ZeroSSL'
  ],
  // Alert thresholds
  shortValidityDays: 30, // Alert if cert valid for less than this
  checkIntervalMinutes: 60, // How often to check
  // crt.sh API endpoint
  crtShUrl: 'https://crt.sh/?q=%25.{domain}&output=json'
};

// Known wildcard patterns to flag
const WILDCARD_PATTERNS = [
  /^\*\./,
  /^\*\.netlify\.app$/,
  /^\*\.nightfallsquadron\.pl$/
];

// Store seen certificates to avoid duplicate alerts
const seenCertificates = new Set();

function fetchFromCrtSh(domain) {
  const url = CONFIG.crtShUrl.replace('{domain}', domain);
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse JSON for ${domain}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

function isAuthorizedCA(issuerName) {
  return CONFIG.authorizedCAs.some(ca =>
    issuerName.toLowerCase().includes(ca.toLowerCase())
  );
}

function isWildcardCert(commonName, nameValue) {
  const names = [commonName, ...(nameValue || '').split('\n')];
  return names.some(name =>
    WILDCARD_PATTERNS.some(pattern => pattern.test(name.trim()))
  );
}

function getValidityDays(notBefore, notAfter) {
  const start = new Date(notBefore);
  const end = new Date(notAfter);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatAlert(cert, domain, alertType, details) {
  const timestamp = new Date().toISOString();
  return `
╔══════════════════════════════════════════════════════════════════╗
║  CT LOG ALERT - ${timestamp}                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Domain: ${domain.padEnd(56)} ║
║  Alert Type: ${alertType.padEnd(56)} ║
║  Details: ${details.padEnd(56)} ║
║  Certificate:                                                     ║
║    ID: ${(cert.id || 'N/A').toString().padEnd(56)} ║
║    Issuer: ${(cert.issuer_name || cert.issuer || 'N/A').padEnd(56)} ║
║    Common Name: ${(cert.common_name || cert.name_value || 'N/A').padEnd(56)} ║
║    Not Before: ${(cert.not_before || 'N/A').padEnd(56)} ║
║    Not After: ${(cert.not_after || 'N/A').padEnd(56)} ║
║    Serial: ${(cert.serial_number || 'N/A').padEnd(56)} ║
╚══════════════════════════════════════════════════════════════════╝
`;
}

function checkCertificate(cert, domain) {
  const certId = `${cert.id}-${cert.serial_number}`;
  if (seenCertificates.has(certId)) {
    return; // Already alerted on this cert
  }
  seenCertificates.add(certId);

  const issuerName = cert.issuer_name || cert.issuer || '';
  const commonName = cert.common_name || '';
  const nameValue = cert.name_value || '';
  const notBefore = cert.not_before;
  const notAfter = cert.not_after;

  // Check 1: Unauthorized CA
  if (!isAuthorizedCA(issuerName)) {
    console.log(formatAlert(cert, domain, 'UNAUTHORIZED CA',
      `Issuer "${issuerName}" is not in authorized CA list`));
  }

  // Check 2: Wildcard certificate
  if (isWildcardCert(commonName, nameValue)) {
    console.log(formatAlert(cert, domain, 'WILDCARD CERTIFICATE',
      `Wildcard certificate detected for ${commonName || nameValue}`));
  }

  // Check 3: Short validity
  if (notBefore && notAfter) {
    const validityDays = getValidityDays(notBefore, notAfter);
    if (validityDays <= CONFIG.shortValidityDays) {
      console.log(formatAlert(cert, domain, 'SHORT VALIDITY',
        `Certificate valid for only ${validityDays} days (threshold: ${CONFIG.shortValidityDays})`));
    }
  }

  // Check 4: Phishing lookalikes for discord.gg
  if (domain === 'discord.gg') {
    const allNames = [commonName, ...nameValue.split('\n')].map(n => n.trim().toLowerCase());
    const phishingPatterns = [
      'discord.gg',
      'discordapp.com',
      'discord.com',
      'discord.gift',
      'discord.nitro'
    ];
    const suspicious = allNames.some(name =>
      phishingPatterns.some(p => name.includes(p)) &&
      !name.includes('discord.gg') // Allow legitimate discord.gg
    );
    if (suspicious) {
      console.log(formatAlert(cert, domain, 'PHISHING LOOKALIKE',
        `Suspicious domain name detected: ${commonName || nameValue}`));
    }
  }
}

async function checkDomain(domain) {
  try {
    console.log(`[${new Date().toISOString()}] Checking CT logs for: ${domain}`);
    const certs = await fetchFromCrtSh(domain);

    if (!certs || certs.length === 0) {
      console.log(`  No certificates found for ${domain}`);
      return;
    }

    console.log(`  Found ${certs.length} certificate entries`);

    for (const cert of certs) {
      checkCertificate(cert, domain);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking ${domain}:`, error.message);
  }
}

async function runCheck() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CT Log Monitor Run - ${new Date().toISOString()}`);
  console.log(`Monitoring: ${CONFIG.domains.join(', ')}`);
  console.log(`Authorized CAs: ${CONFIG.authorizedCAs.join(', ')}`);
  console.log(`Short validity threshold: ${CONFIG.shortValidityDays} days`);
  console.log(`Check interval: ${CONFIG.checkIntervalMinutes} minutes`);
  console.log(`${'='.repeat(60)}\n`);

  for (const domain of CONFIG.domains) {
    await checkDomain(domain);
    // Small delay between requests to be nice to crt.sh
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n[${new Date().toISOString()}] Check complete. Next run in ${CONFIG.checkIntervalMinutes} minutes.\n`);
}

// Run once immediately, then on interval
runCheck();
setInterval(runCheck, CONFIG.checkIntervalMinutes * 60 * 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down CT log monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down CT log monitor...');
  process.exit(0);
});