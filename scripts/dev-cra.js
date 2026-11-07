// scripts/dev-cra.js
// Wrapper startowy CRA dla `netlify dev`.
//
// Dlaczego istnieje: port 3000 na tej maszynie trwale zajmuje inny projekt
// (PM2 "NFS Management" binduje 127.0.0.1:3000). `netlify dev` przy
// autodetekcji CRA wstrzykuje dziecku PORT=3000, a dotenv nie nadpisuje
// istniejących zmiennych — więc .env.local z PORT=3007 jest ignorowany.
// Wrapper ustawia process.env.PORT **po** starcie procesu, więc nic go
// nie nadpisze. Port musi zgadzać się z targetPort w [dev] netlify.toml.
process.env.PORT = process.env.DEV_CRA_PORT || "3007";
process.env.BROWSER = "none";
// Hot reload przez proxy netlify dev (8888): bez tego WDS łączy się
// z portem CRA (3007), a CSP blokuje cross-origin ws. Port 8888 =
// same-origin → przepuszczane przez connect-src 'self'.
process.env.WDS_SOCKET_PORT = "8888";
require("react-scripts/scripts/start.js");
