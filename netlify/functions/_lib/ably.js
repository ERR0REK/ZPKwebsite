// netlify/functions/_lib/ably.js
//
// Wspólny adapter publikacji Ably — używa createHttpClient (stateless HTTP)
// z @ably/pubsub-server. Bez WebSocket, bez close(), bez wiszących połączeń.
//
// Interfejs:
//   publish(channel, event, payload) → { published, reason? }
//
// Zasady:
//   - NIGDY nie rzuca — realtime jest "bonusem" nad storage; handler decyduje,
//     czy brak publikacji ma być błędem (announce) czy ciszą (kos/war).
//   - Brak ABLY_API_KEY → { published: false, reason: "not_configured" }.
//   - Błąd sieci/Ably → log + { published: false, reason: <message> }.

const { createHttpClient } = require("@ably/pubsub-server");

const http = createHttpClient({ key: process.env.ABLY_API_KEY });

async function publish(channel, event, payload) {
  if (!process.env.ABLY_API_KEY) {
    return { published: false, reason: "not_configured" };
  }

  try {
    await http.channels.get(channel).publish(event, payload);
    return { published: true };
  } catch (err) {
    console.warn(`ably publish ${channel}/${String(event)} skipped:`, err && err.message ? err.message : err);
    return { published: false, reason: String((err && err.message) || err) };
  }
}

module.exports = { publish };
