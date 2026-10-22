import ExcelJS from 'exceljs'
import AppError from './AppError.js'

// Pagbasa ng Excel (.xlsx) para sa Bulk Import (Legacy Record Migration).
// Ibinabalik sa parehong hugis ng CSV parsing ({ headers, rows }, lahat ng
// value ay text), kaya pareho ang Map Columns, Validate, at Import pagkatapos.

// Ang .xlsx ay ZIP file ("PK\x03\x04" sa simula). Ang lumang .xls (Excel
// 97–2003) ay ibang format (OLE, "D0 CF 11 E0"), na hindi binabasa rito.
export const isXlsxBuffer = (buffer) => buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50
export const isLegacyXlsBuffer = (buffer) => buffer.length > 4 && buffer.readUInt32LE(0) === 0xe011cfd0

// Ang 5 MB na .xlsx ay puwedeng lumaki nang daan-daang MB pag-unzip ("zip
// bomb"). Binabasa muna ang listahan ng laman ng ZIP (central directory) at
// tinatanggihan kapag sobrang laki, bago pa i-unzip ni exceljs.
const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
const MAX_ROWS = 20000

function uncompressedZipSize(buffer) {
  const stop = Math.max(0, buffer.length - 65557)
  for (let i = buffer.length - 22; i >= stop; i--) {
    if (buffer.readUInt32LE(i) !== 0x06054b50) continue
    const entries = buffer.readUInt16LE(i + 10)
    let offset = buffer.readUInt32LE(i + 16)
    let total = 0
    for (let n = 0; n < entries; n++) {
      if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) return null
      total += buffer.readUInt32LE(offset + 24)
      offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32)
    }
    return total
  }
  return null
}

const pad = (n) => String(n).padStart(2, '0')

// Cell value ni exceljs → text na gaya ng nasa CSV
function cellText(value) {
  if (value == null) return ''
  // Totoong petsa sa Excel: UTC midnight ang Date ni exceljs, kaya UTC getters
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result) // formula
    if (Array.isArray(value.richText)) return value.richText.map((t) => t.text).join('').trim()
    if ('text' in value) return cellText(value.text) // hyperlink (hal. email)
    return '' // #N/A at iba pang error
  }
  return String(value).trim()
}

export async function readXlsx(buffer) {
  const size = uncompressedZipSize(buffer)
  if (size == null || size > MAX_UNCOMPRESSED_BYTES) {
    throw new AppError('That Excel file could not be read. Open it in Excel and save it again as .xlsx.', 422)
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    throw new AppError('That Excel file could not be read. Open it in Excel and save it again as .xlsx.', 422)
  }

  // Unang nakikitang sheet na may laman
  const sheet = workbook.worksheets.find((ws) => ws.state === 'visible' && ws.actualRowCount > 0)
  if (!sheet) throw new AppError('The Excel file has no rows to import', 422)
  if (sheet.actualRowCount > MAX_ROWS + 1) {
    throw new AppError(`The Excel file has too many rows (limit ${MAX_ROWS}). Split it into smaller files.`, 422)
  }

  // Header = unang row na may laman
  let headerRow = null
  const columns = [] // [column index, header]
  const rows = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (!headerRow) {
      headerRow = row.number
      const seen = new Set()
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        const header = cellText(cell.value)
        if (header && !seen.has(header)) {
          seen.add(header)
          columns.push([col, header])
        }
      })
      return
    }
    const record = {}
    let hasValue = false
    for (const [col, header] of columns) {
      const text = cellText(row.getCell(col).value)
      record[header] = text
      if (text) hasValue = true
    }
    if (hasValue) rows.push(record)
  })

  return { headers: columns.map(([, header]) => header), rows }
}

// Blangkong template (.xlsx): bold at naka-freeze ang header, Text format sa
// phone at tooth columns (para hindi mawala ang "0" sa 0917...), date format
// sa mga petsa, at dropdown sa Sex at sa mga Yes/No na tanong.
export async function buildXlsxTemplate(columns) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Patients', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map((c) => ({
    header: c.title,
    key: c.field,
    width: Math.max(14, Math.min(40, c.title.length + 4)),
    style: c.kind === 'text' ? { numFmt: '@' } : c.kind === 'date' ? { numFmt: 'mm/dd/yyyy' } : {},
  }))
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE7F6' } }
  header.alignment = { vertical: 'middle', wrapText: true }
  header.height = 32
  // Ang header row mismo ay General, hindi Text/Date
  header.eachCell((cell) => {
    cell.numFmt = 'General'
  })

  columns.forEach((c, i) => {
    if (!c.choices) return
    const letter = sheet.getColumn(i + 1).letter
    sheet.dataValidations.add(`${letter}2:${letter}5000`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${c.choices.join(',')}"`],
      showErrorMessage: true,
      errorStyle: 'warning',
      error: `Choose one of: ${c.choices.join(', ')}`,
    })
  })

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
