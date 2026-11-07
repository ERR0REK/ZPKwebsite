/**
 * Testy logiki geo-block (edge function) — uruchamiane bezpośrednio node'em.
 * Uruchom: node netlify/edge-functions/geo-block.test.cjs
 *
 * Edge function eksportuje default (handler) i config — ładujemy plik
 * jako moduł ESM przez data URL i mockujemy request/context.
 */
const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.join(__dirname, 'geo-block.js');
const code = fs.readFileSync(MODULE_PATH, 'utf8');
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, name) {
  if (cond) {
    passed++;
    console.log('  OK  ' + name);
  } else {
    failed++;
    failures.push(name);
    console.log('  FAIL ' + name);
  }
}

function mockRequest(ua, headers) {
  const h = new Map(Object.entries(headers || {}));
  if (ua) h.set('user-agent', ua);
  return {
    headers: {
      get: (k) => h.get(k.toLowerCase()) ?? null,
    },
  };
}

function mockContext(geo) {
  return {
    geo,
    next: async () => new Response('NEXT', { status: 200 }),
  };
}

/** Kill switche funkcja czyta z Netlify.env / Deno.env — mockujemy globalThis. */
function withNetlifyEnv(map, fn) {
  globalThis.Netlify = { env: { get: (k) => map[k] } };
  return Promise.resolve(fn()).finally(() => {
    delete globalThis.Netlify;
  });
}

(async () => {
  const mod = await import(dataUrl);
  const handler = mod.default;
  const config = mod.config;

  console.log('== config ==');
  assert(config && config.path === '/*', 'config.path = /*');
  assert(Array.isArray(config.excludedPath) && config.excludedPath.includes('/api/*'), 'excludedPath zawiera /api/*');

  console.log('== kraj PL -> przepuszczony ==');
  {
    const res = await handler(mockRequest('Mozilla/5.0 Chrome/120'), mockContext({ country: { code: 'PL' } }));
    assert(res.status === 200 && (await res.text()) === 'NEXT', 'PL: 200 + next()');
  }

  console.log('== kraj inny (DE, US, UA) -> 451 + strona blokady ==');
  for (const cc of ['DE', 'US', 'UA']) {
    const res = await handler(mockRequest('Mozilla/5.0 Chrome/120'), mockContext({ country: { code: cc } }));
    const text = await res.text();
    assert(res.status === 451, cc + ': status 451');
    assert(text.includes('Zjednoczona Polska Korona'), cc + ': strona blokady z nazwą klanu');
    assert(text.includes('available only to visitors from Poland'), cc + ': wyjaśnienie po angielsku');
  }

  console.log('== brak danych geo -> przepuszczony (fail-open) ==');
  {
    const res = await handler(mockRequest('Mozilla/5.0'), mockContext(null));
    assert(res.status === 200, 'brak geo: 200');
  }

  console.log('== bot indeksujący z DE -> przepuszczony (SEO) ==');
  {
    const res = await handler(
      mockRequest('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
      mockContext({ country: { code: 'DE' } })
    );
    assert(res.status === 200, 'Googlebot z DE: 200');
  }

  console.log('== strona blokady: Discord + akcje ==');
  {
    const res = await handler(mockRequest('Mozilla/5.0'), mockContext({ country: { code: 'US' } }));
    const text = await res.text();
    assert(text.includes('https://discord.gg/A3wE5mGryB'), 'link do Discorda na stronie blokady');
    assert(text.includes('Dołącz do naszego Discorda'), 'przycisk Discorda');
    assert(text.includes('href="/"'), 'przycisk powrotu/odświeżenia');
  }

  console.log('== brak białej listy: każdy kraj poza PL dostaje 451 ==');
  {
    const gb = await handler(mockRequest('Mozilla/5.0'), mockContext({ country: { code: 'GB' } }));
    assert(gb.status === 451, 'GB: 451');
    const de = await handler(mockRequest('Mozilla/5.0'), mockContext({ country: { code: 'de' } }));
    assert(de.status === 451, 'de (małe litery): 451');
  }

  console.log('== kill switch: GEO_BLOCK_DISABLED=1 -> przepuszczony ==');
  await withNetlifyEnv({ GEO_BLOCK_DISABLED: '1' }, async () => {
    const res = await handler(mockRequest('Mozilla/5.0'), mockContext({ country: { code: 'DE' } }));
    assert(res.status === 200, 'GEO_BLOCK_DISABLED=1: 200');
  });

  console.log('== kill switch: CONTEXT=dev -> przepuszczony ==');
  await withNetlifyEnv({ CONTEXT: 'dev' }, async () => {
    const res = await handler(mockRequest('Mozilla/5.0'), mockContext({ country: { code: 'DE' } }));
    assert(res.status === 200, 'CONTEXT=dev: 200');
  });

  console.log('== fallback nagłówek x-nf-geo-country ==');
  {
    const res = await handler(mockRequest('Mozilla/5.0', { 'x-nf-geo-country': 'DE' }), mockContext(null));
    assert(res.status === 451, 'header x-nf-geo-country: 451');
  }

  console.log('== nagłówki odpowiedzi 451 ==');
  {
    const res = await handler(mockRequest('Mozilla/5.0'), mockContext({ country: { code: 'US' } }));
    assert(res.headers.get('x-robots-tag') === 'noindex', 'x-robots-tag: noindex');
    assert(res.headers.get('content-language') === 'pl', 'content-language: pl');
    assert(res.headers.get('cache-control') === 'no-store', 'cache-control: no-store');
  }

  console.log('== dziwne dane geo -> nie crashuje ==');
  {
    const res = await handler(mockRequest('Mozilla/5.0', { 'x-nf-geo-country': 'PL' }), mockContext({ country: {} }));
    assert(typeof res.status === 'number', 'geo bez kodu kraju: brak crasha');
  }

  console.log('\nWynik: ' + passed + ' OK, ' + failed + ' FAIL');
  if (failed > 0) {
    console.log('Niepowodzenia: ' + failures.join('; '));
    process.exit(1);
  }
})();
