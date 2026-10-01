# DentaVault — Deployment Guide (Vercel + Render + Aiven)

Libre lahat. **Pang-demo/defense lang ito, hindi pang-totoong clinic**: sample data lang, walang
totoong patient data (Data Privacy Act), at non-commercial lang ang Vercel Hobby.

```
Browser ──► Vercel (React build + PWA)
              │  /api/*  (rewrite / proxy, server-side)
              ▼
            Render (Express API) ──► Aiven (MySQL, SSL)
              ▲            └──────► Cloudinary (X-ray files)
Mailgun ──────┘  (diretso sa Render ang inbound webhook)
```

Dahil pinapasa ng Vercel ang `/api` sa Render, **iisang domain** ang nakikita ng browser:
walang CORS, at walang binago sa frontend code (`/api` pa rin ang tinatawag).

---

## 0. Bago magsimula

- [ ] I-commit at i-push sa GitHub (`Propeta144/DentaVault`) ang lahat ng changes. Galing sa GitHub ang build ng Vercel at Render.
- [ ] Siguraduhing **hindi** naka-commit ang `server/.env` (nasa `.gitignore` na).

## 1. Aiven (MySQL)

1. Mag-sign up sa https://aiven.io → **Create service** → **MySQL** → **Free plan**. Piliin ang pinakamalapit na region.
2. Pagka-running, kopyahin sa **Overview → Connection information**: Host, Port, User (`avnadmin`), Password, Database (`defaultdb`).
3. I-download ang **CA certificate** (`ca.pem`) sa parehong page.
4. Patakbuhin ang migrations **mula sa computer mo** papunta sa Aiven (PowerShell, sa `server/` folder).
   Mas nauuna ang mga `$env:` values kaysa sa `.env`, kaya hindi gagalawin ang local DB:

   ```powershell
   $env:DB_HOST="xxxx.aivencloud.com"; $env:DB_PORT="12345"; $env:DB_USER="avnadmin"
   $env:DB_PASSWORD="..."; $env:DB_NAME="defaultdb"
   $env:DB_SSL_CA = Get-Content "C:\path\to\ca.pem" -Raw
   npm run migrate
   node db/seed.js dentist@email.com "MalakasNaPassword"
   ```

   Pagkatapos, isara ang PowerShell window para mawala ang `$env:` values.
5. Sample patients: i-import sa app mismo (Patients → Import CSV) pagka-deploy na. **Huwag kopyahin ang local DB**:
   ang mga lumang X-ray row ay tumuturo sa `server/uploads/xrays/` (local disk), na wala sa Render.

## 2. Render (Express API)

1. https://render.com → **New → Web Service** → ikonekta ang GitHub repo.
2. Settings:

   | Field | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |
   | Region | Singapore (pinakamalapit sa PH) |
   | Health Check Path | `/api/health` |

3. **Environment variables:**

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | galing sa Aiven |
   | `DB_SSL_CA` | buong laman ng `ca.pem` (i-paste, kasama ang BEGIN/END lines) |
   | `JWT_SECRET` | **bago at mahabang random string** (huwag gamitin ang nasa local) |
   | `JWT_EXPIRES_IN` | `8h` |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | galing sa local `.env` |
   | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_WEBHOOK_SIGNING_KEY` | galing sa local `.env` |
   | `TRUST_PROXY` | `4` (Vercel + Cloudflare + Render LB + Render internal proxy, para tama ang IP sa Audit Log; tingnan ang Gotcha #7) |
   | `CLINIC_TIMEZONE` | *(optional)* default `Asia/Manila`. Ginagamit sa "hindi puwedeng future" na check ng mga petsa (UTC ang oras ng Render) |
   | `AUDIT_RETENTION_ENABLED` | `false` (tingnan ang Gotcha #2) |

   Hindi kailangan ang `PORT` (si Render ang nagse-set) at `CORS_ORIGIN` (same-origin dahil sa Vercel proxy).
4. Deploy. Kopyahin ang URL (hal. `https://dentavault-api.onrender.com`) at subukan ang
   `https://<url>/api/health`. Dapat `{"status":"ok"}` ang lalabas.

## 3. Vercel (Frontend)

1. Buksan ang `client/vercel.json` at palitan ang `PALITAN-NG-RENDER-URL.onrender.com` ng totoong Render URL. Commit at push.
2. https://vercel.com → **Add New → Project** → i-import ang GitHub repo.
3. Settings: **Root Directory** = `client`, Framework = **Vite** (auto-detect). Walang env vars na kailangan.
4. Deploy. Buksan ang Vercel URL at mag-login gamit ang dentist account na ginawa sa Step 1.

## 4. Mailgun (inbound X-ray email)

Sa Mailgun → **Receiving → Routes**, palitan ang forward URL ng:
`https://<render-url>/api/webhooks/mailgun/inbound`
(Diretso sa Render, hindi sa Vercel. Hindi browser ang Mailgun, kaya hindi kailangan ang proxy.)

---

## Verification checklist (pagka-deploy)

- [ ] `/api/health` sa Vercel URL → `{"status":"ok"}` (patunay na gumagana ang proxy)
- [ ] Login bilang dentist → Dashboard
- [ ] Register/Import ng sample patient → lumalabas sa list
- [ ] Mag-upload ng X-ray (subukan ang **maliit** at **malaki, mga 5–10 MB**, tingnan ang Gotcha #3) → lumalabas ang thumbnail
- [ ] Dental chart → mag-save ng condition
- [ ] Audit Log → tama ang IP Address (IP mo, hindi IP ng Render/Vercel)
- [ ] Refresh sa `/patients/profile` → hindi 404 (SPA rewrite)
- [ ] Mag-email ng X-ray sa Mailgun address → may "New" badge

---

## Gotchas

1. **Natutulog ang Render free** pagkatapos ng 15 minutong walang request, at mga 1 minuto bago magising.
   Sa araw ng defense, buksan ang app **5–10 minuto bago** magsimula. (Kaya ng Vercel proxy ang hanggang 120s, kaya hindi ito magta-timeout.)
2. **Nabubura ang lokal na files sa Render** tuwing restart o deploy. Lokal na file ang audit log archive
   (`server/archives/`), kaya **naka-off ang retention job sa Render** (`AUDIT_RETENTION_ENABLED=false`).
   Walang nawawala dahil walang binubura sa DB. Hindi rin ito kailangan ngayon: bago pa ang Aiven DB, kaya
   walang log na lalampas sa 365 araw bago ang defense. Kapag gagamitin na sa totoong clinic, ilipat muna ang archive sa Cloudinary o sa DB.
3. **Upload size sa Vercel proxy (hindi pa nasusubok):** may 4.5 MB body limit ang Vercel Functions. Hindi
   malinaw sa docs kung kasama rito ang external rewrites. Hanggang 15 MB ang X-ray upload natin. Kapag
   pumalya ang malaking upload (413 error), ang ayos ay idiretso sa Render URL ang X-ray upload request (kailangan ng CORS).
4. **Hindi gagana online ang mga lumang X-ray** na naka-save sa local disk. Cloudinary lang ang gumagana sa Render.
5. **Bagong `JWT_SECRET` sa production.** Kapag pinalitan ito, kailangang mag-login ulit ang lahat.
6. **PWA:** pagkatapos ng bawat deploy, lalabas ang "update available" prompt sa mga naka-install na app (`registerType: 'prompt'`).
7. **IP Address sa Audit Log (`TRUST_PROXY=4`), sinubukan nang live:** `2` = Cloudflare IP, `3` = Vercel server IP,
   `4` = totoong IP ng user. Limitasyon: ipinapasa ng Vercel rewrite ang `X-Forwarded-For` na galing sa user, kaya
   mapepeke ang IP ng sadyang nagpadala ng pekeng header (hal. gamit ang curl). Hindi napepeke ang user (galing sa JWT).
   Kapag nagpalit ng hosting, subukan ulit ang bilang.
8. **Bagong migration = patakbuhin din sa Aiven.** Hindi ito ginagawa ng Render nang kusa. Bago/kasabay ng push,
   sa `server/`: `$env:DOTENV_CONFIG_PATH=".env.aiven"; npm run migrate`. Kapag nauna ang code (hal. 010
   `must_change_password`), magkakaroon ng database error ang login hangga't wala ang column.

## Code changes para sa deployment

| Name | Type | Purpose |
|---|---|---|
| `server/src/config/dbSsl.js` | **NEW** | `dbSslOptions()`: SSL na may CA verification kapag naka-set ang `DB_SSL_CA` (Aiven). Walang SSL sa local. |
| `server/src/config/db.js` | MODIFIED | Ginagamit ang `dbSslOptions()` sa pool. |
| `server/db/migrate.js` | MODIFIED | Ginagamit din ang `dbSslOptions()`, kaya kayang mag-migrate papunta sa Aiven. |
| `server/src/app.js` | MODIFIED | `trust proxy` kapag naka-set ang `TRUST_PROXY`, para tama ang `req.ip` sa likod ng Vercel at Render. |
| `server/package.json` | MODIFIED | `engines.node >=22`, para hindi lumang Node ang gamitin ni Render. |
| `server/.env.example` | MODIFIED | `DB_SSL_CA`, `TRUST_PROXY`. |
| `client/vercel.json` | **NEW** | `/api/*` → Render (proxy); lahat ng iba → `index.html` (React Router). |
