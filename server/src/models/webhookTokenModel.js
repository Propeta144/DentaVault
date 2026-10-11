import pool from '../config/db.js'

// Replay protection ng Mailgun webhook (security review, #26): ang `token`
// sa bawat napirmahang request ay isang beses lang tatanggapin. Ang pirma ni
// Mailgun ay para sa timestamp + token lang, HINDI sa laman ng email, kaya
// ang sinumang makakuha ng isang tunay na request ay puwedeng magpadala ulit
// nito na may ibang sender/attachment kung walang ganitong check.
//
// Itinatala lang PAGKATAPOS ng matagumpay na proseso: parehong token kasi ang
// dala ng retry ni Mailgun, kaya kapag pumalya ang una (hal. down ang
// Cloudinary), gagana pa rin ang retry.

const KEEP_DAYS = 2 // mas mahaba sa 9 oras na tinatanggap na edad ng timestamp

export async function isWebhookTokenUsed(token) {
  const [rows] = await pool.execute('SELECT 1 FROM mailgun_webhook_tokens WHERE token = :token LIMIT 1', { token })
  return rows.length > 0
}

export async function markWebhookTokenUsed(token) {
  await pool.execute('INSERT IGNORE INTO mailgun_webhook_tokens (token) VALUES (:token)', { token })
  // Paglilinis: maliit na table, may index sa used_at
  await pool.execute(
    `DELETE FROM mailgun_webhook_tokens WHERE used_at < NOW() - INTERVAL ${KEEP_DAYS} DAY`,
  )
}
