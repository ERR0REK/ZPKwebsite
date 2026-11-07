#!/usr/bin/env python3
"""
Typosquat Domain Generator and Analyzer for:
- zpkwebsite.netlify.app
- nightfallsquadron.pl

Features:
- Permutations (character swaps, omissions, repetitions, insertions)
- Homoglyph substitutions (Unicode lookalikes)
- Bitsquatting (bit-flipping)
- TLD variations
- Subdomain takeover checks
- Certificate Transparency log queries via crt.sh
"""

import itertools
import string
import dns.resolver
import dns.exception
import requests
import json
import time
from datetime import datetime
from urllib.parse import urlparse
import concurrent.futures
from typing import List, Dict, Set, Tuple
import sys

# ============================================================
# TARGET DOMAINS
# ============================================================
TARGET_DOMAINS = [
    "zpkwebsite.netlify.app",
    "nightfallsquadron.pl"
]

# ============================================================
# HOMOGLYPH MAPPINGS (Unicode lookalikes)
# ============================================================
HOMOGLYPHS = {
    'a': ['а', 'ɑ', 'α', 'а', 'à', 'á', 'â', 'ã', 'ä', 'å', 'ā', 'ą', 'ă'],
    'b': ['Ь', 'в', 'ḃ', 'ḅ', 'ḇ', 'ƀ', 'ᵬ', 'ᶀ', 'ɓ'],
    'c': ['с', 'ϲ', 'ċ', 'ć', 'ĉ', 'ċ', 'č', 'ç', 'ḉ'],
    'd': ['ԁ', 'ď', 'đ', 'ḑ', 'ḋ', 'ḍ', 'ḏ', 'ḓ', 'ð', 'ɗ'],
    'e': ['е', 'е', 'ė', 'ę', 'ě', 'ê', 'ë', 'ē', 'ĕ', 'ě', 'ҽ'],
    'f': ['ƒ', 'ḟ', 'ḟ', 'ḟ'],
    'g': ['ɡ', 'ġ', 'ģ', 'ĝ', 'ğ', 'ǧ', 'ǵ', 'ḡ'],
    'h': ['һ', 'ħ', 'ĥ', 'ȟ', 'ḣ', 'ḧ', 'ḥ', 'ḫ', 'ẖ'],
    'i': ['і', 'ı', 'í', 'î', 'ï', 'ĩ', 'ī', 'ĭ', 'į', 'ǐ', 'ҥ', 'ӏ'],
    'j': ['ј', 'ĵ', 'ǰ', 'ɉ'],
    'k': ['κ', 'ķ', 'ǩ', 'ḳ', 'ḵ', 'ƙ', 'ⱪ'],
    'l': ['ⅼ', 'ľ', 'ĺ', 'ļ', 'ḷ', 'ḹ', 'ḻ', 'ḽ', 'ŀ', 'ƚ', 'ł'],
    'm': ['м', 'ṁ', 'ṃ', 'ḿ', 'ɱ', 'Ɱ'],
    'n': ['п', 'ń', 'ņ', 'ň', 'ṅ', 'ṇ', 'ṉ', 'ṋ', 'ñ', 'ƞ', 'ǹ'],
    'o': ['о', 'ο', 'о', 'ø', 'ō', 'ŏ', 'ő', 'ơ', 'ǒ', 'ǫ', 'ǭ', 'ō', 'ọ', 'ỏ', 'ố', 'ồ', 'ổ', 'ỗ', 'ộ', 'ớ', 'ờ', 'ở', 'ỡ', 'ợ'],
    'p': ['р', 'ṗ', 'ṕ', 'ƥ', 'ᵽ'],
    'q': ['ԛ', 'ɋ'],
    'r': ['г', 'ŕ', 'ŗ', 'ř', 'ṙ', 'ṛ', 'ṝ', 'ṟ', 'ɾ', 'ɽ'],
    's': ['ѕ', 'ś', 'ŝ', 'š', 'ṡ', 'ṣ', 'ṥ', 'ṧ', 'ṩ', 'ß', 'ʂ'],
    't': ['т', 'ţ', 'ť', 'ṫ', 'ṭ', 'ṯ', 'ṱ', 'ẗ', 'ŧ', 'ƫ', 'ʈ'],
    'u': ['υ', 'ú', 'û', 'ü', 'ũ', 'ū', 'ŭ', 'ů', 'ű', 'ų', 'ư', 'ǔ', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
    'v': ['ѵ', 'ṽ', 'ṿ', 'ʋ', 'ⱱ'],
    'w': ['ԝ', 'ẁ', 'ẃ', 'ŵ', 'ẅ', 'ẇ', 'ẉ', 'ⱳ'],
    'x': ['х', 'ẋ', 'ẍ'],
    'y': ['у', 'ý', 'ÿ', 'ŷ', 'ỹ', 'ȳ', 'ɏ', 'ƴ', 'ỵ', 'ỷ', 'ỳ', 'ỵ', 'ỹ'],
    'z': ['ᴢ', 'ź', 'ż', 'ž', 'ẓ', 'ẕ', 'ƶ', 'ⱬ'],
    '0': ['О', 'ο', 'о', 'Ø', '○'],
    '1': ['l', 'I', 'і', 'ⅼ', '|', 'ǀ', '丨'],
    '2': ['ƻ', 'ƻ'],
    '3': ['Ɛ', 'Ʒ', 'З'],
    '4': ['Ǝ', 'Ꮞ'],
    '5': ['Ѕ', 'Ƽ'],
    '6': ['б', 'ԓ'],
    '7': ['Τ', 'Ƭ'],
    '8': ['В', '8'],
    '9': ['g', 'q', '۹'],
    '.': ['․', '․', '・', '·', '‧'],
    '-': ['‑', '–', '—', '−', '˗', '⁻', '₋'],
}

# ============================================================
# KEYBOARD LAYOUTS FOR TYPO GENERATION
# ============================================================
QWERTY_NEIGHBORS = {
    'q': 'wa', 'w': 'qesa', 'e': 'wrsd', 'r': 'etdf', 't': 'ryfgh',
    'y': 'tughj', 'u': 'yihjk', 'i': 'uojkl', 'o': 'ipkl', 'p': 'ol',
    'a': 'qwsz', 's': 'awedxz', 'd': 'serfcx', 'f': 'drtgvb', 'g': 'ftyhbn',
    'h': 'gyujnm', 'j': 'huikm', 'k': 'jlo', 'l': 'kp',
    'z': 'asx', 'x': 'zsdc', 'c': 'xdfv', 'v': 'cfgb', 'b': 'vghn', 'n': 'bhjm', 'm': 'njk',
    '1': '2', '2': '13', '3': '24', '4': '35', '5': '46',
    '6': '57', '7': '68', '8': '79', '9': '80', '0': '9',
    '.': ',', ',': '.', '-': '=', '=': '-',
}

# ============================================================
# COMMON TLD VARIATIONS
# ============================================================
TLD_VARIATIONS = [
    '.com', '.net', '.org', '.info', '.biz', '.co', '.io', '.dev', '.app',
    '.pl', '.eu', '.de', '.fr', '.uk', '.nl', '.it', '.es', '.cz', '.sk',
    '.xyz', '.online', '.site', '.website', '.tech', '.store', '.shop',
    '.live', '.cloud', '.digital', '.space', '.world', '.global',
    '.net.pl', '.com.pl', '.org.pl', '.info.pl', '.biz.pl',
]

# ============================================================
# SUBDOMAIN TAKEOVER FINGERPRINTS (common services)
# ============================================================
TAKEOVER_FINGERPRINTS = {
    'github.io': 'There isn\'t a GitHub Pages site here',
    'github.com': 'There isn\'t a GitHub Pages site here',
    'herokuapp.com': 'No such app',
    'heroku.com': 'No such app',
    'netlify.app': 'Not Found',
    'netlify.com': 'Not Found',
    'vercel.app': 'The deployment could not be found',
    'vercel.com': 'The deployment could not be found',
    'surge.sh': 'project not found',
    'firebaseapp.com': 'Site Not Found',
    'web.app': 'Site Not Found',
    'azurewebsites.net': '404 Web Site not found',
    'cloudfront.net': 'The request could not be satisfied',
    's3.amazonaws.com': 'NoSuchBucket',
    's3-website': 'NoSuchBucket',
    'github.io': 'There isn\'t a GitHub Pages site here',
    'gitlab.io': 'The page could not be found',
    'bitbucket.io': 'Repository not found',
    'readthedocs.io': 'Project doesn\'t exist',
    'shopify.com': 'Sorry, this shop is currently unavailable',
    'wpengine.com': 'The site you were looking for couldn\'t be found',
    'pantheonsite.io': 'The gods are wise',
    'platform.sh': 'The project you were looking for could not be found',
    'fastly.net': 'Fastly error: unknown domain',
    'cloudflare.com': 'Direct IP access not allowed',
}

# ============================================================
# TYPOSQUATTING TECHNIQUES
# ============================================================

def get_domain_parts(domain: str) -> Tuple[str, str, str]:
    """Split domain into subdomain, domain, TLD"""
    parts = domain.split('.')
    if len(parts) >= 3 and parts[-2] in ['co', 'com', 'net', 'org', 'gov', 'edu', 'pl']:
        tld = '.'.join(parts[-2:])
        domain_name = parts[-3]
        subdomain = '.'.join(parts[:-3]) if len(parts) > 3 else ''
    else:
        tld = parts[-1]
        domain_name = parts[-2]
        subdomain = '.'.join(parts[:-2]) if len(parts) > 2 else ''
    return subdomain, domain_name, tld

def generate_permutations(domain: str) -> Set[str]:
    """Generate permutation-based typosquats"""
    results = set()
    subdomain, domain_name, tld = get_domain_parts(domain)
    full_domain = f"{domain_name}.{tld}"

    # Character omission (delete one char)
    for i in range(len(full_domain)):
        if full_domain[i] != '.':
            variant = full_domain[:i] + full_domain[i+1:]
            results.add(variant)

    # Character repetition (duplicate one char)
    for i in range(len(full_domain)):
        if full_domain[i] != '.':
            variant = full_domain[:i] + full_domain[i] + full_domain[i:]
            results.add(variant)

    # Character swap (adjacent transposition)
    for i in range(len(full_domain) - 1):
        if full_domain[i] != '.' and full_domain[i+1] != '.':
            variant = full_domain[:i] + full_domain[i+1] + full_domain[i] + full_domain[i+2:]
            results.add(variant)

    # Character insertion (add random char)
    chars = 'abcdefghijklmnopqrstuvwxyz0123456789-'
    for i in range(len(full_domain) + 1):
        for c in chars:
            variant = full_domain[:i] + c + full_domain[i:]
            results.add(variant)

    # Character replacement (keyboard typos)
    for i, ch in enumerate(full_domain):
        if ch in QWERTY_NEIGHBORS:
            for neighbor in QWERTY_NEIGHBORS[ch]:
                variant = full_domain[:i] + neighbor + full_domain[i+1:]
                results.add(variant)

    # Add subdomain back if it existed
    if subdomain:
        final_results = set()
        for r in results:
            final_results.add(f"{subdomain}.{r}")
        results = final_results

    return results

def generate_homoglyphs(domain: str) -> Set[str]:
    """Generate homoglyph-based typosquats"""
    results = set()
    subdomain, domain_name, tld = get_domain_parts(domain)
    full_domain = f"{domain_name}.{tld}"

    def replace_chars(text: str, pos: int = 0, current: str = "") -> Set[str]:
        if pos >= len(text):
            return {current}

        ch = text[pos].lower()
        variants = replace_chars(text, pos + 1, current + text[pos])

        if ch in HOMOGLYPHS:
            for h in HOMOGLYPHS[ch]:
                variants.update(replace_chars(text, pos + 1, current + h))

        return variants

    homoglyph_variants = replace_chars(full_domain)
    results.update(homoglyph_variants)

    # Add subdomain back if it existed
    if subdomain:
        final_results = set()
        for r in results:
            final_results.add(f"{subdomain}.{r}")
        results = final_results

    return results

def generate_bitsquats(domain: str) -> Set[str]:
    """Generate bitsquatting variants (single bit flips)"""
    results = set()
    subdomain, domain_name, tld = get_domain_parts(domain)
    full_domain = f"{domain_name}.{tld}"

    for i, ch in enumerate(full_domain):
        if ch == '.':
            continue
        byte_val = ord(ch)
        for bit in range(8):
            flipped = byte_val ^ (1 << bit)
            if 32 <= flipped <= 126:  # Printable ASCII
                new_char = chr(flipped)
                if new_char.isalnum() or new_char in '-.':
                    variant = full_domain[:i] + new_char + full_domain[i+1:]
                    results.add(variant)

    if subdomain:
        final_results = set()
        for r in results:
            final_results.add(f"{subdomain}.{r}")
        results = final_results

    return results

def generate_tld_variations(domain: str) -> Set[str]:
    """Generate TLD variation typosquats"""
    results = set()
    subdomain, domain_name, tld = get_domain_parts(domain)

    for new_tld in TLD_VARIATIONS:
        if new_tld != f".{tld}":
            variant = f"{domain_name}{new_tld}"
            if subdomain:
                variant = f"{subdomain}.{variant}"
            results.add(variant)

    # Also try common misspellings of the TLD
    tld_typos = {
        'com': ['con', 'cmo', 'ocm', 'cm', 'comm', 'c0m'],
        'net': ['nwt', 'nte', 'ent', 'met', 'n3t'],
        'org': ['ogr', 'rog', '0rg', 'orgg'],
        'pl': ['pk', 'lp', 'p1', 'pi'],
        'app': ['ap', 'pp', 'aap', 'appp'],
        'dev': ['de', 'dv', 'dew', 'd3v'],
        'io': ['i0', 'lo', '1o'],
        'co': ['c0', 'oc'],
    }

    if tld in tld_typos:
        for typo in tld_typos[tld]:
            variant = f"{domain_name}.{typo}"
            if subdomain:
                variant = f"{subdomain}.{variant}"
            results.add(variant)

    return results

def generate_combosquats(domain: str) -> Set[str]:
    """Generate combosquatting variants (adding keywords)"""
    results = set()
    subdomain, domain_name, tld = get_domain_parts(domain)

    keywords = [
        'www', 'mail', 'email', 'web', 'app', 'api', 'admin', 'login', 'signin',
        'secure', 'security', 'support', 'help', 'service', 'services', 'portal',
        'dashboard', 'panel', 'cp', 'cpanel', 'whm', 'webmail', 'owa', 'exchange',
        'vpn', 'remote', 'ssh', 'ftp', 'sftp', 'git', 'svn', 'jenkins', 'ci', 'cd',
        'staging', 'stage', 'dev', 'development', 'test', 'testing', 'qa', 'uat',
        'prod', 'production', 'live', 'backup', 'bak', 'old', 'new', 'beta', 'alpha',
        'demo', 'try', 'get', 'download', 'dl', 'cdn', 'static', 'assets', 'media',
        'images', 'img', 'css', 'js', 'api', 'v1', 'v2', 'v3', 'graphql', 'rest',
        'oauth', 'sso', 'saml', 'ldap', 'ad', 'auth', 'identity', 'idp', 'account',
        'billing', 'payments', 'pay', 'checkout', 'cart', 'shop', 'store', 'buy',
        'blog', 'news', 'docs', 'documentation', 'wiki', 'kb', 'knowledge', 'faq',
        'status', 'health', 'monitor', 'metrics', 'logs', 'alerting', 'pingdom',
        'datadog', 'newrelic', 'sentry', 'rollbar', 'bugsnag', 'loggly', 'papertrail',
    ]

    for kw in keywords:
        # prefix
        variant = f"{kw}-{domain_name}.{tld}"
        if subdomain:
            variant = f"{subdomain}.{variant}"
        results.add(variant)

        variant = f"{kw}.{domain_name}.{tld}"
        if subdomain:
            variant = f"{subdomain}.{variant}"
        results.add(variant)

        # suffix
        variant = f"{domain_name}-{kw}.{tld}"
        if subdomain:
            variant = f"{subdomain}.{variant}"
        results.add(variant)

    return results

def generate_all_typosquats(domain: str) -> Dict[str, Set[str]]:
    """Generate all types of typosquats for a domain"""
    print(f"\n[+] Generating typosquats for: {domain}")

    all_results = {
        'permutations': generate_permutations(domain),
        'homoglyphs': generate_homoglyphs(domain),
        'bitsquats': generate_bitsquats(domain),
        'tld_variations': generate_tld_variations(domain),
        'combosquats': generate_combosquats(domain),
    }

    for category, variants in all_results.items():
        print(f"    {category}: {len(variants)} variants")

    return all_results

# ============================================================
# DNS RESOLUTION CHECKS
# ============================================================

def check_dns(domain: str, record_type: str = 'A') -> List[str]:
    """Check DNS resolution for a domain"""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 5
        answers = resolver.resolve(domain, record_type)
        return [str(rdata) for rdata in answers]
    except (dns.exception.DNSException, Exception):
        return []

def check_domain_exists(domain: str) -> Dict:
    """Check if domain resolves (A, AAAA, CNAME, MX)"""
    result = {
        'domain': domain,
        'exists': False,
        'a_records': [],
        'aaaa_records': [],
        'cname_records': [],
        'mx_records': [],
        'ns_records': [],
    }

    for rtype, key in [('A', 'a_records'), ('AAAA', 'aaaa_records'),
                       ('CNAME', 'cname_records'), ('MX', 'mx_records'),
                       ('NS', 'ns_records')]:
        records = check_dns(domain, rtype)
        if records:
            result['exists'] = True
            result[key] = records

    return result

def check_subdomain_takeover(domain: str) -> Dict:
    """Check for subdomain takeover vulnerability"""
    result = {
        'domain': domain,
        'vulnerable': False,
        'service': None,
        'cname_chain': [],
        'evidence': None,
    }

    # Get CNAME chain
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 10
        resolver.lifetime = 10

        current = domain
        visited = set()

        while current not in visited and len(visited) < 10:
            visited.add(current)
            try:
                answers = resolver.resolve(current, 'CNAME')
                for rdata in answers:
                    target = str(rdata.target).rstrip('.')
                    result['cname_chain'].append(f"{current} -> {target}")
                    current = target

                    # Check fingerprints
                    for service, fingerprint in TAKEOVER_FINGERPRINTS.items():
                        if service in target:
                            # Try to verify by fetching the page
                            try:
                                resp = requests.get(f"http://{current}", timeout=10, allow_redirects=True)
                                if fingerprint.lower() in resp.text.lower():
                                    result['vulnerable'] = True
                                    result['service'] = service
                                    result['evidence'] = fingerprint
                            except:
                                pass
            except dns.exception.DNSException:
                break
    except Exception as e:
        result['error'] = str(e)

    return result

# ============================================================
# CERTIFICATE TRANSPARENCY LOG QUERIES
# ============================================================

def query_crt_sh(domain: str) -> List[Dict]:
    """Query crt.sh for certificates matching domain"""
    url = "https://crt.sh/"
    params = {
        'q': f"%.{domain}",
        'output': 'json',
    }

    try:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return data
    except Exception as e:
        print(f"    Error querying crt.sh for {domain}: {e}")

    return []

def query_crt_sh_exact(domain: str) -> List[Dict]:
    """Query crt.sh for exact domain match"""
    url = "https://crt.sh/"
    params = {
        'q': domain,
        'output': 'json',
    }

    try:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            return data
    except Exception as e:
        print(f"    Error querying crt.sh for exact {domain}: {e}")

    return []

def check_ct_logs_for_variants(variants: Set[str], max_checks: int = 50) -> Dict[str, List[Dict]]:
    """Check Certificate Transparency logs for variant domains"""
    results = {}
    checked = 0

    for variant in variants:
        if checked >= max_checks:
            break

        certs = query_crt_sh_exact(variant)
        if certs:
            results[variant] = certs
            print(f"    [CT] Found certs for: {variant} ({len(certs)} entries)")

        checked += 1
        time.sleep(0.1)  # Rate limiting

    return results

# ============================================================
# MAIN ANALYSIS
# ============================================================

def analyze_domain(domain: str) -> Dict:
    """Complete analysis of a target domain"""
    print(f"\n{'='*60}")
    print(f"ANALYZING: {domain}")
    print(f"{'='*60}")

    results = {
        'target': domain,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'typosquats': {},
        'dns_checks': {},
        'takeover_checks': {},
        'ct_logs': {},
        'summary': {},
    }

    # Generate all typosquats
    typosquats = generate_all_typosquats(domain)
    results['typosquats'] = {k: list(v) for k, v in typosquats.items()}

    # Combine all variants for checking
    all_variants = set()
    for variants in typosquats.values():
        all_variants.update(variants)

    print(f"\n[+] Total unique variants to check: {len(all_variants)}")

    # Check DNS for top variants (limit to prevent excessive queries)
    print(f"\n[+] Checking DNS resolution for variants...")
    dns_results = {}
    checked = 0
    max_dns_checks = 200

    for variant in all_variants:
        if checked >= max_dns_checks:
            break

        dns_result = check_domain_exists(variant)
        if dns_result['exists']:
            dns_results[variant] = dns_result
            print(f"    [DNS] RESOLVES: {variant} -> A: {dns_result['a_records']}, CNAME: {dns_result['cname_records']}")

        checked += 1

    results['dns_checks'] = dns_results

    # Check subdomain takeover for resolving domains
    print(f"\n[+] Checking subdomain takeover for resolving domains...")
    takeover_results = {}
    for variant, dns_data in dns_results.items():
        if dns_data['cname_records']:
            takeover_result = check_subdomain_takeover(variant)
            if takeover_result['vulnerable']:
                takeover_results[variant] = takeover_result
                print(f"    [TAKEOVER] VULNERABLE: {variant} -> {takeover_result['service']}")

    results['takeover_checks'] = takeover_results

    # Check CT logs for variants
    print(f"\n[+] Checking Certificate Transparency logs...")
    ct_results = check_ct_logs_for_variants(all_variants, max_checks=100)
    results['ct_logs'] = {k: len(v) for k, v in ct_results.items()}  # Just count

    # Also check target domain in CT logs
    target_certs = query_crt_sh(domain)
    if target_certs:
        results['ct_logs'][f"{domain} (target)"] = len(target_certs)
        print(f"    [CT] Target domain has {len(target_certs)} certificate entries")

    # Summary
    results['summary'] = {
        'total_variants_generated': len(all_variants),
        'variants_by_type': {k: len(v) for k, v in typosquats.items()},
        'resolving_variants': len(dns_results),
        'takeover_vulnerable': len(takeover_results),
        'ct_log_matches': len(ct_results),
    }

    print(f"\n[+] SUMMARY for {domain}:")
    print(f"    Total variants: {results['summary']['total_variants_generated']}")
    print(f"    Resolving: {results['summary']['resolving_variants']}")
    print(f"    Takeover vulnerable: {results['summary']['takeover_vulnerable']}")
    print(f"    CT log matches: {results['summary']['ct_log_matches']}")

    return results

def main():
    print("Typosquat Domain Analysis Tool")
    print("Targets:", ", ".join(TARGET_DOMAINS))

    all_results = {}

    for domain in TARGET_DOMAINS:
        try:
            all_results[domain] = analyze_domain(domain)
        except Exception as e:
            print(f"[ERROR] Failed to analyze {domain}: {e}")
            import traceback
            traceback.print_exc()

    # Save results
    output_file = f"typosquat_analysis_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Analysis complete. Results saved to: {output_file}")
    print(f"{'='*60}")

    # Print final summary
    print("\nFINAL SUMMARY:")
    for domain, results in all_results.items():
        s = results['summary']
        print(f"\n  {domain}:")
        print(f"    Variants generated: {s['total_variants_generated']}")
        print(f"    Resolving: {s['resolving_variants']}")
        print(f"    Takeover vulnerable: {s['takeover_vulnerable']}")
        print(f"    CT log matches: {s['ct_log_matches']}")

        if results['dns_checks']:
            print(f"    Resolving domains:")
            for var, data in list(results['dns_checks'].items())[:10]:
                print(f"      {var} -> A: {data['a_records'][:3]}")

        if results['takeover_checks']:
            print(f"    TAKEOVER VULNERABLE:")
            for var, data in results['takeover_checks'].items():
                print(f"      {var} -> {data['service']}")

if __name__ == "__main__":
    main()