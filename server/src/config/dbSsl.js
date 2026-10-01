// SSL para sa database connection. Sa local (XAMPP) walang SSL, kaya
// walang ibinabalik dito kapag hindi naka-set ang env vars. Sa Aiven
// (production), SSL ang required, at sarili nilang CA ang pumirma sa
// certificate — kaya kailangang ibigay ang CA (`DB_SSL_CA`, galing sa
// Aiven console) para ma-verify talaga ang server, hindi basta tanggapin.
//
// Hiwalay na file 'to (hindi sa db.js) para magamit din ng db/migrate.js
// nang hindi gumagawa ng connection pool.
export function dbSslOptions() {
  const ca = process.env.DB_SSL_CA
  if (ca) {
    // Pwedeng naka-isang linya ang PEM sa env var (may literal na "\n"),
    // depende sa hosting dashboard — ibalik sa totoong newlines.
    return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true }
  }
  if (process.env.DB_SSL === 'true') return { rejectUnauthorized: true }
  return undefined
}
