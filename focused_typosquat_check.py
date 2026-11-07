#!/usr/bin/env python3
"""
Focused Typosquat Analysis - High-Risk Variants Only
"""

import dns.resolver
import requests
import json
import itertools
from datetime import datetime

# Target domains
TARGETS = [
    "zpkwebsite.netlify.app",
    "nightfallsquadron.pl"
]

# High-value homoglyphs (most deceptive)
HIGH_VALUE_HOMOGLYPHS = {
    'a': ['а', 'ɑ'],      # Cyrillic 'a', Latin alpha
    'e': ['е', 'ė'],      # Cyrillic 'e', e with dot
    'i': ['і', 'ı', 'ӏ'], # Cyrillic 'i', dotless i, Cyrillic palochka
    'o': ['о', 'ο', 'ø'], # Cyrillic 'o', Greek omicron, slashed o
    'p': ['р'],           # Cyrillic 'p'
    'c': ['с', 'ϲ'],      # Cyrillic 'c', Greek lunate sigma
    'x': ['х'],           # Cyrillic 'x'
    'y': ['у', 'у'],      # Cyrillic 'y'
    'n': ['п'],           # Cyrillic 'n' (actually 'p' shape)
    'l': ['ⅼ', 'ł'],      # Roman numeral, Polish l
    's': ['ѕ', 'š'],      # Cyrillic 's', s with caron
    'd': ['ԁ'],           # Cyrillic 'd'
    'g': ['ɡ'],           # Latin small letter g (script)
    'j': ['ј'],           # Cyrillic 'j'
    'u': ['υ'],           # Greek upsilon
    'w': ['ԝ'],           # Cyrillic 'w'
    'z': ['ᴢ'],           # Small caps Z
    '0': ['О', 'ο', 'ø'], # Cyrillic O, Greek omicron, slashed o
    '1': ['l', 'і', 'Ⅰ'], # lowercase L, Cyrillic i, Roman numeral
    '.': ['․'],           # One dot leader
    '-': ['‑', '–'],      # Non-breaking hyphen, en dash
}

# Keyboard neighbors (QWERTY)
KEYBOARD = {
    'q': 'wa', 'w': 'qesa', 'e': 'wrsd', 'r': 'etdf', 't': 'ryfgh',
    'y': 'tughj', 'u': 'yihjk', 'i': 'uojkl', 'o': 'ipkl', 'p': 'ol',
    'a': 'qwsz', 's': 'awedxz', 'd': 'serfcx', 'f': 'drtgvb', 'g': 'ftyhbn',
    'h': 'gyujnm', 'j': 'huikm', 'k': 'jlo', 'l': 'kp',
    'z': 'asx', 'x': 'zsdc', 'c': 'xdfv', 'v': 'cfgb', 'b': 'vghn', 'n': 'bhjm', 'm': 'njk',
}

# TLD variations for nightfallsquadron.pl
TLD_VARIANTS_PL = ['.com', '.net', '.org', '.info', '.biz', '.eu', '.com.pl', '.net.pl', '.org.pl', '.xyz', '.online', '.site', '.tech', '.store', '.shop']

# TLD variations for netlify.app
TLD_VARIANTS_NETLIFY = ['.com', '.net', '.org', '.io', '.dev', '.app', '.co', '.xyz', '.online', '.site']

def get_base_domain(domain):
    """Get the base domain part (without subdomain/TLD)"""
    parts = domain.split('.')
    if domain.endswith('.netlify.app'):
        return 'zpkwebsite', 'netlify.app'
    elif domain.endswith('.pl'):
        return 'nightfallsquadron', 'pl'
    else:
        return parts[-2], parts[-1]

def generate_homoglyphs(base, tld):
    """Generate high-value homoglyph variants"""
    results = []
    for i, ch in enumerate(base):
        if ch in HIGH_VALUE_HOMOGLYPHS:
            for h in HIGH_VALUE_HOMOGLYPHS[ch]:
                variant = base[:i] + h + base[i+1:]
                results.append(f"{variant}.{tld}")
    return results

def generate_keyboard_typos(base, tld):
    """Generate keyboard typo variants"""
    results = []
    for i, ch in enumerate(base):
        if ch in KEYBOARD:
            for neighbor in KEYBOARD[ch]:
                variant = base[:i] + neighbor + base[i+1:]
                results.append(f"{variant}.{tld}")
    return results

def generate_omissions(base, tld):
    """Generate character omission variants"""
    results = []
    for i in range(len(base)):
        variant = base[:i] + base[i+1:]
        if variant:
            results.append(f"{variant}.{tld}")
    return results

def generate_repetitions(base, tld):
    """Generate character repetition variants"""
    results = []
    for i in range(len(base)):
        variant = base[:i] + base[i] + base[i:]
        results.append(f"{variant}.{tld}")
    return results

def generate_transpositions(base, tld):
    """Generate adjacent character transposition"""
    results = []
    for i in range(len(base) - 1):
        variant = base[:i] + base[i+1] + base[i] + base[i+2:]
        results.append(f"{variant}.{tld}")
    return results

def generate_tld_variants(base, tld):
    """Generate TLD variations"""
    results = []
    if tld == 'pl':
        for new_tld in TLD_VARIANTS_PL:
            results.append(f"{base}{new_tld}")
    elif tld == 'netlify.app':
        for new_tld in TLD_VARIANTS_NETLIFY:
            results.append(f"{base}{new_tld}")
    return results

def generate_bitsquats(base, tld):
    """Generate bitsquatting (single bit flip)"""
    results = []
    for i, ch in enumerate(base):
        if ch == '.': continue
        byte_val = ord(ch)
        for bit in range(8):
            flipped = byte_val ^ (1 << bit)
            if 32 <= flipped <= 126:
                new_char = chr(flipped)
                if new_char.isalnum() or new_char in '-':
                    variant = base[:i] + new_char + base[i+1:]
                    results.append(f"{variant}.{tld}")
    return list(set(results))

def generate_combosquats(base, tld):
    """Generate common combosquats"""
    prefixes = ['www', 'mail', 'api', 'admin', 'login', 'app', 'web', 'secure', 'support', 'dev', 'staging', 'test', 'prod', 'cdn', 'assets', 'static']
    results = []
    for p in prefixes:
        results.append(f"{p}-{base}.{tld}")
        results.append(f"{p}.{base}.{tld}")
        results.append(f"{base}-{p}.{tld}")
    return results

def check_dns(domain):
    """Quick DNS check"""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 3
        resolver.lifetime = 3
        a = resolver.resolve(domain, 'A')
        return [str(r) for r in a]
    except:
        return None

def check_cname(domain):
    """Check CNAME"""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 3
        resolver.lifetime = 3
        cname = resolver.resolve(domain, 'CNAME')
        return [str(r.target) for r in cname]
    except:
        return None

def check_ct_logs(domain):
    """Quick CT log check"""
    try:
        resp = requests.get('https://crt.sh/', params={'q': domain, 'output': 'json'}, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            return len(data)
    except:
        pass
    return 0

def analyze_domain(domain):
    """Analyze a single domain"""
    print(f"\n{'='*60}")
    print(f"ANALYZING: {domain}")
    print(f"{'='*60}")

    base, tld = get_base_domain(domain)
    print(f"Base: {base}, TLD: {tld}")

    # Generate all variants
    all_variants = set()

    print("\n[+] Generating variants...")
    homoglyphs = generate_homoglyphs(base, tld)
    all_variants.update(homoglyphs)
    print(f"  Homoglyphs: {len(homoglyphs)}")

    keyboard = generate_keyboard_typos(base, tld)
    all_variants.update(keyboard)
    print(f"  Keyboard typos: {len(keyboard)}")

    omissions = generate_omissions(base, tld)
    all_variants.update(omissions)
    print(f"  Omissions: {len(omissions)}")

    repetitions = generate_repetitions(base, tld)
    all_variants.update(repetitions)
    print(f"  Repetitions: {len(repetitions)}")

    transpositions = generate_transpositions(base, tld)
    all_variants.update(transpositions)
    print(f"  Transpositions: {len(transpositions)}")

    tld_vars = generate_tld_variants(base, tld)
    all_variants.update(tld_vars)
    print(f"  TLD variations: {len(tld_vars)}")

    bitsquats = generate_bitsquats(base, tld)
    all_variants.update(bitsquats)
    print(f"  Bitsquats: {len(bitsquats)}")

    combosquats = generate_combosquats(base, tld)
    all_variants.update(combosquats)
    print(f"  Combosquats: {len(combosquats)}")

    print(f"\n[+] Total unique variants: {len(all_variants)}")

    # Check DNS for all variants (with some concurrency)
    print("\n[+] Checking DNS resolution...")
    resolving = {}

    # Check in batches
    variant_list = list(all_variants)
    for i in range(0, len(variant_list), 20):
        batch = variant_list[i:i+20]
        for variant in batch:
            a_records = check_dns(variant)
            if a_records:
                cname_records = check_cname(variant)
                resolving[variant] = {'A': a_records, 'CNAME': cname_records}
                print(f"  [RESOLVES] {variant} -> A: {a_records[:3]}, CNAME: {cname_records}")

        # Small delay to not overwhelm DNS
        import time
        time.sleep(0.2)

    print(f"\n[+] Resolving variants: {len(resolving)}")

    # Check CT logs for resolving variants + target
    print("\n[+] Checking Certificate Transparency logs...")
    ct_results = {}

    # Check target domain
    ct_count = check_ct_logs(domain)
    if ct_count > 0:
        ct_results[domain] = ct_count
        print(f"  [CT] {domain}: {ct_count} entries")

    # Check top resolving variants
    for variant in list(resolving.keys())[:30]:
        ct_count = check_ct_logs(variant)
        if ct_count > 0:
            ct_results[variant] = ct_count
            print(f"  [CT] {variant}: {ct_count} entries")

    # Check subdomain takeover for CNAME variants
    print("\n[+] Checking subdomain takeover...")
    takeover_services = {
        'netlify.app': 'Not Found',
        'netlify.com': 'Not Found',
        'herokuapp.com': 'No such app',
        'heroku.com': 'No such app',
        'vercel.app': 'The deployment could not be found',
        'github.io': "There isn't a GitHub Pages site here",
        'github.com': "There isn't a GitHub Pages site here",
        'azurewebsites.net': '404 Web Site not found',
        'cloudfront.net': 'The request could not be satisfied',
        's3.amazonaws.com': 'NoSuchBucket',
        'firebaseapp.com': 'Site Not Found',
        'web.app': 'Site Not Found',
        'surge.sh': 'project not found',
        'gitlab.io': 'The page could not be found',
    }

    takeovers = {}
    for variant, data in resolving.items():
        if data.get('CNAME'):
            for cname in data['CNAME']:
                for service, fingerprint in takeover_services.items():
                    if service in cname:
                        try:
                            resp = requests.get(f"http://{cname}", timeout=10, allow_redirects=True)
                            if fingerprint.lower() in resp.text.lower():
                                takeovers[variant] = {'service': service, 'cname': cname, 'fingerprint': fingerprint}
                                print(f"  [TAKEOVER] {variant} -> {service} ({cname})")
                        except:
                            pass

    # Summary
    summary = {
        'target': domain,
        'base': base,
        'tld': tld,
        'total_variants': len(all_variants),
        'variant_breakdown': {
            'homoglyphs': len(homoglyphs),
            'keyboard_typos': len(keyboard),
            'omissions': len(omissions),
            'repetitions': len(repetitions),
            'transpositions': len(transpositions),
            'tld_variations': len(tld_vars),
            'bitsquats': len(bitsquats),
            'combosquats': len(combosquats),
        },
        'resolving_count': len(resolving),
        'resolving_domains': resolving,
        'ct_log_matches': ct_results,
        'takeover_vulnerable': takeovers,
    }

    return summary

def main():
    print("Focused Typosquat Analysis")
    print(f"Targets: {TARGETS}")

    all_results = {}
    for domain in TARGETS:
        try:
            all_results[domain] = analyze_domain(domain)
        except Exception as e:
            print(f"Error analyzing {domain}: {e}")
            import traceback
            traceback.print_exc()

    # Save results
    output_file = f"typosquat_focused_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(all_results, f, indent=2, default=str)

    print(f"\n{'='*60}")
    print(f"Results saved to: {output_file}")
    print(f"{'='*60}")

    # Print summary
    print("\n\nFINAL SUMMARY")
    print("="*60)
    for domain, results in all_results.items():
        print(f"\n{domain}:")
        print(f"  Total variants generated: {results['total_variants']}")
        for k, v in results['variant_breakdown'].items():
            print(f"    {k}: {v}")
        print(f"  Resolving domains: {results['resolving_count']}")
        if results['resolving_domains']:
            for var, data in list(results['resolving_domains'].items())[:10]:
                print(f"    {var} -> A: {data['A'][:3]}, CNAME: {data['CNAME']}")
        print(f"  CT log matches: {len(results['ct_log_matches'])}")
        for var, count in results['ct_log_matches'].items():
            print(f"    {var}: {count}")
        print(f"  Subdomain takeover vulnerable: {len(results['takeover_vulnerable'])}")
        for var, data in results['takeover_vulnerable'].items():
            print(f"    {var} -> {data['service']} ({data['cname']})")

if __name__ == "__main__":
    main()