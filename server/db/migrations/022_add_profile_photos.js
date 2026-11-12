// Idempotent kahit ma-interrupt sa pagitan ng dalawang tables.
export async function up(connection) {
  for (const table of ['users', 'patients']) {
    const [columns] = await connection.execute(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table],
    )
    const existing = new Set(columns.map(column => column.COLUMN_NAME))
    for (const [name, definition] of [['photo_file', 'VARCHAR(255) NULL'], ['photo_version', 'CHAR(36) NULL']]) {
      if (!existing.has(name)) await connection.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`)
    }
  }
}
