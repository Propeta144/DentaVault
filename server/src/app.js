import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

// Sa production, dumadaan ang request sa Vercel (proxy ng /api), Cloudflare,
// load balancer ng Render, at internal proxy ng Render bago makarating dito.
// Kung walang 'trust proxy', ::1 (internal proxy) ang lalabas sa req.ip, kaya
// mali ang IP Address sa Audit Log. Bilang ito ng proxy hops na lalaktawan
// mula sa dulo ng X-Forwarded-For. TRUST_PROXY=4 (sinubukan nang live): 3 =
// IP ng Vercel server, 4 = IP ng user. Hindi naka-set sa local.
//
// Limitasyon: ipinapasa ng Vercel rewrite ang X-Forwarded-For na galing sa
// user, kaya mapepeke ang IP ng sadyang gumawa ng pekeng header (hal. curl).
// Hindi napepeke kung SINO ang gumawa (galing sa JWT), IP Address lang.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY))
}

app.use(helmet())
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || '').split(',').filter(Boolean),
    credentials: true,
  }),
)
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json())

app.use('/api', routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
