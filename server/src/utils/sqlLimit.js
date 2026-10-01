// LIMIT/OFFSET clause na direktang naka-interpolate, hindi `:limit`
// placeholder. Sa MySQL 8 (Aiven), pumapalya ang `pool.execute()` kapag
// placeholder ang LIMIT ("Incorrect arguments to mysqld_stmt_execute"),
// kasi ipinapadala ni mysql2 ang JS numbers bilang DOUBLE, at integer lang
// ang tinatanggap ng LIMIT. Hindi ito lumalabas sa XAMPP (MariaDB).
//
// Ligtas i-interpolate dahil laging buong non-negative integer ang lumalabas
// dito (Math.trunc + Math.max), kahit ano pa ang ipasa (hal. "2.5", -1, "abc").
export function limitOffset(limit, offset = 0) {
  const toInt = (n) => Math.max(0, Math.trunc(Number(n)) || 0)
  return `LIMIT ${toInt(limit)} OFFSET ${toInt(offset)}`
}
