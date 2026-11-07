/**
 * netlify/edge-functions/geo-block.js
 *
 * BLOKADA GEO — strona dostępna wyłącznie z Polski.
 *
 * Dlaczego edge function, a nie redirect z Country=...:
 * Redirecty Netlify NIE obsługują negacji ("każdy oprócz PL") —
 * potwierdzone przez pracownika Netlify (answers.netlify.com/t/42228).
 * Edge function ma dostęp do geolokalizacji (context.geo) i decyduje
 * na krawędzi CDN, zanim cokolwiek się załaduje.
 *
 * Zasady:
 *  1. Kraj znany i INNY niż PL  ->  451 + strona blokady (surowy HTML,
 *     zero zależności zewnętrznych — działa zawsze).
 *  2. Kraj znany i PL           ->  normalna strona.
 *  3. BRAK danych geo           ->  przepuść (fail-open: lokalne testy,
 *     curl, monitoring, środowiska bez geolokalizacji).
 *  4. Boty indeksujące (Googlebot, bingbot...) -> przepuść.
 *     Świadomie: strona zostaje w wynikach Google (przeforsowany SEO),
 *     a osoba spoza PL i tak dostanie blokadę po kliknięciu.
 *     UA bota da się podrobić — to ściana dla przypadkowych gości,
 *     nie mechanizm anty-DDoS.
 *  5. Kill switch: GEO_BLOCK_DISABLED=1 albo CONTEXT=dev (lokalny dev
 *     i tunel ngrok dla kolegi) -> blokada w ogóle nie działa.
 *     Na produkcji te zmienne nie są ustawione -> blokada aktywna.
 */

const ALLOWED_COUNTRY = 'PL';

/* Strona blokady — w 100% samowystarczalna (inline CSS, fonty systemowe,
 * zero obrazków), więc nie zależy od CSP, plików ani fontów Google. */
const BLOCK_PAGE_HTML = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Dostęp tylko z Polski | Zjednoczona Polska Korona</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0a;
    color: #e8e8e8;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    padding: 24px;
  }
  .card {
    max-width: 580px;
    width: 100%;
    background: #111;
    border: 1px solid #2a2a2a;
    border-top: 3px solid #8b1a1a;
    border-radius: 12px;
    padding: 44px 36px 36px;
    text-align: center;
  }
  .monogram {
    display: inline-block;
    padding: 10px 22px;
    border: 2px solid #d4af37;
    border-radius: 8px;
    color: #d4af37;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 6px;
    margin-bottom: 26px;
  }
  h1 {
    font-size: 24px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 16px;
    color: #f5f5f5;
  }
  p { line-height: 1.65; font-size: 15px; color: #bdbdbd; margin-bottom: 12px; }
  .en { font-size: 13px; color: #8a8a8a; }
  .actions { margin: 24px 0 10px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .btn {
    display: inline-block;
    padding: 11px 22px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    letter-spacing: 0.5px;
  }
  .btn-gold { background: #d4af37; color: #111; }
  .btn-gold:hover { background: #e6c35c; }
  .btn-ghost { border: 1px solid #3a3a3a; color: #bdbdbd; }
  .btn-ghost:hover { border-color: #d4af37; color: #d4af37; }
  .hint { margin-top: 6px; }
  .code {
    margin-top: 28px;
    padding-top: 18px;
    border-top: 1px solid #222;
    font-size: 12px;
    letter-spacing: 3px;
    color: #666;
  }
</style>
</head>
<body>
  <main class="card">
    <div class="monogram">ZPK</div>
    <h1>Strona dostępna tylko z Polski</h1>
    <p>Oficjalna strona klanu Zjednoczona Polska Korona jest dostępna
       wyłącznie dla użytkowników z terytorium Polski.</p>
    <p class="en">This website is available only to visitors from Poland.</p>
    <div class="actions">
      <a class="btn btn-gold" href="https://discord.gg/A3wE5mGryB"
         target="_blank" rel="noopener noreferrer">Dołącz do naszego Discorda</a>
      <a class="btn btn-ghost" href="/">Odśwież stronę</a>
    </div>
    <p class="en hint">Polish clan, Polish website. See you on our Discord.</p>
    <div class="code">BŁĄD 451 &middot; GEO-BLOK</div>
  </main>
</body>
</html>`;


function getCountry(request, context) {
  return (
    context?.geo?.country?.code ||
    request.headers.get('x-nf-geo-country') ||
    null
  );
}

function envGet(key) {
  try {
    if (typeof Netlify !== 'undefined' && Netlify.env && Netlify.env.get) {
      return Netlify.env.get(key);
    }
    if (typeof Deno !== 'undefined' && Deno.env && Deno.env.get) {
      return Deno.env.get(key);
    }
  } catch (_e) { /* środowisko bez env — ignoruj */ }
  return undefined;
}

function isIndexingBot(request) {
  const ua = request.headers.get('user-agent') || '';
  // Lista popularnych botów indeksujących - UA da się podrobić,
  // to tylko ochrona przed przypadkowym zablokowaniem SEO.
  const botPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /telegrambot/i,
    /discordbot/i,
    /slackbot/i,
  ];
  return botPatterns.some((re) => re.test(ua));
}

export default async (request, context) => {
  // Kill switch: lokalny dev (CONTEXT=dev ustawia netlify dev) albo
  // ręczne wyłączenie zmienną GEO_BLOCK_DISABLED=1.
  if (envGet('GEO_BLOCK_DISABLED') === '1') return context.next();
  if (envGet('CONTEXT') === 'dev') return context.next();

  const country = getCountry(request, context);
  const isDev = envGet('CONTEXT') === 'dev';

  // Brak danych geo -> fail-open (przepuść).
  // Dotyczy: lokalne testy, curl, monitoring, środowiska bez geolokalizacji.
  // Na produkcji Netlify zazwyczaj dostarcza geo, ale fail-open jest bezpieczniejszy
  // niż blokowanie legalnych użytkowników/usług.
  if (!country) return context.next();

  // Boty indeksujące zostawiamy — SEO strony zostaje intact.
  if (isIndexingBot(request)) return context.next();

  // Jedyna zasada: wchodzisz z Polski -> wpuszczony. Każdy inny kraj -> blokada.
  // (Dawniej tu była biała lista z env — usunięta: strona jest i zostaje
  //  jednojęzyczna, klan jest polski, lista nie miała sensu.)
  if (country === ALLOWED_COUNTRY) return context.next();

  return new Response(BLOCK_PAGE_HTML, {
    status: 451,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-language': 'pl',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex',
      'cache-control': 'no-store',
    },
  });
};

export const config = {
  path: '/*',
  // Assety statyczne, API i pliki dla botów bez blokady — one nie renderują
  // strony, a wykluczenie zmniejsza liczbę wywołań edge function.
  excludedPath: [
    '/api/*',
    '/.netlify/*',
    '/vendor/*',
    '/static/*',
    '/favicon.ico',
    '/logo192.png',
    '/logo512.png',
    '/manifest.json',
    '/robots.txt',
    '/sitemap.xml',
  ],
};
