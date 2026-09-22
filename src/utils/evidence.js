/**
 * src/utils/evidence.js
 *
 * Dowody (screeny) na stronie KOS muszą działać "cross-platform":
 * linki obrazków kopiowane z Discorda (cdn.discordapp.com / media.discordapp.net)
 * mają podpis (?ex=...&hm=...) i WYGAJĄ po ~24h — po tym czasie obrazek
 * na karcie KOS robi się pęknięty. Rozwiązanie: REHOST — serwer pobiera
 * obraz zanim link umrze i wrzuca go na Catbox (linki z Catboxa są wieczne).
 */

const DISCORD_HOST_RE =
  /(^|\.)(cdn\.discordapp\.com|media\.discordapp\.net|discord\.com|discordapp\.com)$/i;

// Czy URL to obraz z Discorda (te linki wygasają)?
export const isDiscordImageUrl = (url) => {
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    return (
      DISCORD_HOST_RE.test(u.hostname) ||
      /\/attachments\//.test(u.pathname)
    );
  } catch (e) {
    return false;
  }
};

// Rehost jednego URL-a przez /api/upload-evidence (tryb "rehost").
// Nigdy nie rzuca — zwraca { ok, url?, error? }.
export const rehostImageUrl = async (url, accessToken) => {
  try {
    const res = await fetch("/api/upload-evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken, mode: "rehost", url }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data && data.ok && data.url) {
      return { ok: true, url: data.url };
    }
    return { ok: false, error: (data && data.error) || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err && err.message) || "NETWORK_ERROR" };
  }
};

/**
 * Przechodzi po liniach dowodów ("image|<url>", "youtube|...", ...) i dla
 * każdego obrazu z Discorda robi rehost. Zwraca nowy tekst + liczniki.
 */
export const rehostEvidenceText = async (text, accessToken) => {
  const lines = String(text || "").split("\n");
  let rehosted = 0;
  let failed = 0;

  const out = await Promise.all(
    lines.map(async (line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("image|")) return line;
      const url = trimmed.slice(6).trim();
      if (!isDiscordImageUrl(url)) return line;

      const result = await rehostImageUrl(url, accessToken);
      if (result.ok) {
        rehosted += 1;
        return `image|${result.url}`;
      }
      failed += 1;
      return line; // zostaw oryginał — nie blokuj dodania celu
    })
  );

  return { text: out.join("\n"), rehosted, failed, changed: rehosted > 0 };
};

// Fallback dla obrazków, których nie da się załadować (np. stare linki
// z Discorda, które wygasły zanim zdążyliśmy zrobić rehost) — zamiast
// „pękniętego obrazka” pokazujemy czytelny placeholder w stylu strony.
export const EVIDENCE_FALLBACK_SRC =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#0b0b0b"/><rect x="8" y="8" width="464" height="304" fill="none" stroke="#fbbf24" stroke-width="3" stroke-dasharray="10 6"/><text x="240" y="150" fill="#fbbf24" font-family="monospace" font-size="26" text-anchor="middle">EVIDENCE</text><text x="240" y="185" fill="#fbbf24" font-family="monospace" font-size="26" text-anchor="middle">UNAVAILABLE</text></svg>'
  );

export const onImageError = (e) => {
  if (e.currentTarget.dataset.broken) return;
  e.currentTarget.dataset.broken = "1"; // nie zapętlaj się
  e.currentTarget.src = EVIDENCE_FALLBACK_SRC;
};
