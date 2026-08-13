import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true, // only needed here, never on the app's query pool
    namedPlaceholders: true,
  })

  // Tracks which files have already run, so re-running `npm run migrate`
  // after adding a new migration doesn't re-execute old ones — several
  // migrations use ALTER TABLE ADD COLUMN, which errors on a second run.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  const [appliedRows] = await connection.query('SELECT filename FROM schema_migrations')
  const applied = new Set(appliedRows.map((r) => r.filename))

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let ranCount = 0
  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
    console.log(`Running migration: ${file}`)
    await connection.query(sql)
    await connection.execute('INSERT INTO schema_migrations (filename) VALUES (:file)', { file })
    ranCount++
  }

  console.log(ranCount > 0 ? `Done. Applied ${ranCount} new migration file(s).` : 'Already up to date.')
  await connection.end()
}

run().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
