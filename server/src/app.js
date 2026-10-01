import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

// Sa production, dumadaan muna ang request sa Vercel (proxy ng /api) at sa
// load balancer ng Render bago makarating dito. Kung walang 'trust proxy',
// ang IP ng Render proxy ang lalabas sa req.ip, kaya mali ang IP Address
// sa Audit Log. Bilang ito ng proxy hops na pagkakatiwalaan (TRUST_PROXY=2
// para sa Vercel + Render). Hindi naka-set sa local, kaya walang epekto.
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
