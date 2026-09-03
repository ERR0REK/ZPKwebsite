// netlify/functions/_lib/ably.js
//
// Wspólny adapter publikacji Ably — eliminuje 3 kopie wzorca
// (kos-store, war-store, announce):
//   new Ably.Realtime({ key }) → channels.get → publish → close (+ try/catch)
//
// Interfejs:
//   publish(channel, event, payload) → { published, reason? }
//
// Zasady:
//   - NIGDY nie rzuca — realtime jest "bonusem" nad storage; handler decyduje,
//     czy brak publikacji ma być błędem (announce) czy ciszą (kos/war).
//   - Brak ABLY_API_KEY → { published: false, reason: "not_configured" }.
//   - Bląd sieci/Ably → log + { published: false, reason: <message> }.
//   - Klient jest zamykany w finally (brak wiszących połączeń).

const Ably = require("ably");

async function publish(channel, event, payload) {
  if (!process.env.ABLY_API_KEY) {
    return { published: false, reason: "not_configured" };
  }

  const client = new Ably.Realtime({ key: process.env.ABLY_API_KEY });
  try {
    const ch = client.channels.get(channel);
    await ch.publish(event, payload);
    return { published: true };
  } catch (err) {
    console.warn(`ably publish ${channel}/${String(event)} skipped:`, err && err.message ? err.message : err);
    return { published: false, reason: String((err && err.message) || err) };
  } finally {
    client.close();
  }
}

module.exports = { publish };
