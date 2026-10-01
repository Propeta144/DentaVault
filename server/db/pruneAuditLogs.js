import 'dotenv/config'
import pool from '../src/config/db.js'
import { pruneAuditLogs, getRetentionConfig } from '../src/services/auditRetentionService.js'

// Manual na pagpapatakbo ng audit log retention (awtomatiko na itong
// tumatakbo araw-araw sa loob ng server — tignan server.js). Gamit:
//   npm run audit:prune -- --dry-run   → bilangin lang, walang babaguhin
//   npm run audit:prune                → i-archive at burahin talaga
const dryRun = process.argv.includes('--dry-run')

try {
  const config = getRetentionConfig()
  console.log(`Retention: view ${config.viewDays} days, change ${config.changeDays} days`)
  console.log(`Archive dir: ${config.archiveDir}`)
  const result = await pruneAuditLogs({ dryRun })
  console.log(
    `${dryRun ? '[DRY RUN] Would archive' : 'Archived'}: ${result.archived.view} view + ${result.archived.change} change entries`,
  )
  if (result.files.length) console.log('Files:', result.files.join(', '))
} catch (err) {
  console.error('Audit log prune failed:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
