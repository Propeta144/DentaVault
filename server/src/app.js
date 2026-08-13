import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import routes from './routes/index.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

const app = express()

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
