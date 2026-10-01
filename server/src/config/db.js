import mysql from 'mysql2/promise'
import { dbSslOptions } from './dbSsl.js'

// Pool, hindi single connection: sabay-sabay kasing hinahandle ni Express
// yung mga requests, kaya bawat isa, huhulugan lang ng connection habang
// tumatakbo yung query niya, tapos ibabalik. Kung isang shared connection
// lang gagamitin, magkaka-serialize lahat ng request.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: dbSslOptions(),
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  // Kung wala 'to, gagawin ni mysql2 na JS Date objects sa midnight UTC yung
  // DATE columns, tapos mag-sshift papuntang previous day 'yon pag na-
  // serialize sa UTC+8 timezone (2026-05-14 -> 2026-05-13T16:00:00Z).
  // Kaya sa halip, panatilihin na lang plain 'YYYY-MM-DD' strings yung DATE
  // columns, para maiwasan lahat 'to — isang date of birth kasi, wala
  // namang time component, hindi dapat na-ttimezone-convert.
  dateStrings: ['DATE'],
})

export default pool
