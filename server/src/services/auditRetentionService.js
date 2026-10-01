import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pool from '../config/db.js'
import { recordAuditLog } from '../models/auditLogModel.js'

// Audit log retention (RA 10173: huwag itago ang personal data nang mas
// matagal kaysa kailangan). Dalawang antas:
//  - "view" tier: pagtingin lang (VIEW_*, GENERATE_*) — mas maikli.
//  - "change" tier: LAHAT ng iba (create/update/delete/export, login,
//    password reset, inbound email...) — mas matagal, kasi ito ang ebidensya
//    kapag may reklamo o imbestigasyon. Sinadyang "lahat ng iba" ang default,
//    para ang bagong action code na makakalimutang i-classify ay mapupunta
//    sa mas mahabang retention, hindi mabubura nang maaga.
// Bago burahin sa database, isinusulat muna sa archive file (JSON Lines,
// isang file bawat buwan), kaya walang nawawala — lumilipat lang palabas ng
// live table.
//
// PLACEHOLDER ang default na 365 / 1825 na araw — hindi pa kumpirmado ang
// legal na tagal para sa dental clinic. Palitan sa .env kapag napagdesisyunan.

const VIEW_ACTION_PREFIXES = ['VIEW_', 'GENERATE_']
const BATCH_SIZE = 1000
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function positiveInt(value, fallback) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export function getRetentionConfig() {
  return {
    enabled: process.env.AUDIT_RETENTION_ENABLED !== 'false',
    viewDays: positiveInt(process.env.AUDIT_RETENTION_VIEW_DAYS, 365),
    changeDays: positiveInt(process.env.AUDIT_RETENTION_CHANGE_DAYS, 1825),
    archiveDir: path.resolve(SERVER_ROOT, process.env.AUDIT_ARCHIVE_DIR || 'archives/audit-logs'),
  }
}

// LEFT(...) = 'VIEW_' imbes na LIKE 'VIEW_%', kasi wildcard ang `_` sa LIKE.
// Galing sa constant sa taas ang prefixes, hindi sa user input.
const viewCondition = VIEW_ACTION_PREFIXES.map((p) => `LEFT(al.action, ${p.length}) = '${p}'`).join(' OR ')
const TIERS = {
  view: `(${viewCondition})`,
  change: `NOT (${viewCondition})`,
}

// Isang batch ng lumang rows para sa isang tier. Kasama ang pangalan at role
// ng user (hindi lang user_id), kasi kapag nabura ang user balang araw,
// magiging NULL ang user_id (ON DELETE SET NULL) — dapat buo pa rin ang
// archive. Naka-format na string ang petsa sa SQL mismo para walang
// timezone shift sa pagitan ng MySQL at Node.
async function fetchBatch(tierCondition, cutoffDays, afterId) {
  const [rows] = await pool.execute(
    `SELECT al.id, al.user_id, u.full_name AS user_name, u.role AS user_role,
            al.action, al.entity_type, al.entity_id, al.details, al.ip_address,
            DATE_FORMAT(al.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(al.created_at, '%Y-%m') AS month
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     WHERE ${tierCondition}
       AND al.created_at < NOW() - INTERVAL :cutoffDays DAY
       AND al.id > :afterId
     ORDER BY al.id
     LIMIT ${BATCH_SIZE}`,
    { cutoffDays, afterId },
  )
  return rows
}

async function appendToArchive(archiveDir, rows) {
  const byMonth = new Map()
  for (const { month, ...row } of rows) {
    if (row.details && typeof row.details === 'string') row.details = JSON.parse(row.details)
    if (!byMonth.has(month)) byMonth.set(month, [])
    byMonth.get(month).push(JSON.stringify(row))
  }
  const files = []
  for (const [month, lines] of byMonth) {
    const file = path.join(archiveDir, `audit-logs-${month}.jsonl`)
    // Append + fsync bago burahin sa DB: kung mag-crash man sa gitna, ang
    // pinakamasamang mangyayari ay may duplicate sa archive (mauulit sa
    // susunod na takbo), HINDI mawawalang log.
    const handle = await fs.open(file, 'a')
    try {
      await handle.write(lines.join('\n') + '\n')
      await handle.sync()
    } finally {
      await handle.close()
    }
    files.push(path.basename(file))
  }
  return files
}

// `dryRun`: bilangin lang kung ilan ang maaapektuhan, walang isusulat o
// buburahin — para ma-check muna bago patakbuhin nang totoo.
export async function pruneAuditLogs({ dryRun = false } = {}) {
  const config = getRetentionConfig()
  const summary = { dryRun, viewDays: config.viewDays, changeDays: config.changeDays, archived: {}, files: [] }

  if (!dryRun) await fs.mkdir(config.archiveDir, { recursive: true })

  for (const [tier, condition] of Object.entries(TIERS)) {
    const cutoffDays = tier === 'view' ? config.viewDays : config.changeDays
    let count = 0
    let afterId = 0
    for (;;) {
      const rows = await fetchBatch(condition, cutoffDays, afterId)
      if (rows.length === 0) break
      afterId = rows[rows.length - 1].id
      count += rows.length
      if (dryRun) continue

      const files = await appendToArchive(config.archiveDir, rows)
      summary.files.push(...files)
      const ids = rows.map((r) => r.id)
      await pool.query('DELETE FROM audit_logs WHERE id IN (?)', [ids])
    }
    summary.archived[tier] = count
  }
  summary.files = [...new Set(summary.files)].sort()

  // Naka-log din ang pag-prune mismo (system event, walang user) — para
  // makita sa Audit Log page na may nailipat sa archive, at kailan.
  const total = summary.archived.view + summary.archived.change
  if (!dryRun && total > 0) {
    await recordAuditLog({
      userId: null,
      action: 'PRUNE_AUDIT_LOGS',
      entityType: 'audit_log',
      details: {
        archivedView: summary.archived.view,
        archivedChange: summary.archived.change,
        viewDays: config.viewDays,
        changeDays: config.changeDays,
        files: summary.files,
      },
    })
  }
  return summary
}

// Awtomatikong takbo sa loob ng server: isang beses ilang segundo pagka-
// start, tapos kada 24 oras. May guard para hindi magsabay ang dalawang
// takbo. Kapag pumalya, log lang sa console — hindi dapat pabagsakin ng
// retention job ang buong API.
const DAY_MS = 24 * 60 * 60 * 1000
let running = false

export function startAuditRetentionJob() {
  const config = getRetentionConfig()
  if (!config.enabled) {
    console.log('Audit log retention: disabled (AUDIT_RETENTION_ENABLED=false)')
    return
  }
  const run = async () => {
    if (running) return
    running = true
    try {
      const result = await pruneAuditLogs()
      const total = result.archived.view + result.archived.change
      if (total > 0) console.log(`Audit log retention: archived ${total} entr${total === 1 ? 'y' : 'ies'}`, result.files)
    } catch (err) {
      console.error('Audit log retention failed:', err.message)
    } finally {
      running = false
    }
  }
  setTimeout(run, 10_000).unref()
  setInterval(run, DAY_MS).unref()
}
