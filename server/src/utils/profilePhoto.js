import AppError from './AppError.js'

// Suriin ang bytes at dimensions, hindi filename/MIME lang. Browser crop
// output lang ang kailangan: baseline/progressive JPEG, hanggang 2048 square.
export function validatePhoto(buffer) {
  const invalid = () => { throw new AppError('That image could not be read. Choose another photo and crop it again.', 415) }
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.length > 2 * 1024 * 1024 || buffer.readUInt16BE(0) !== 0xffd8 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9) invalid()
  let offset = 2, dimensions, hasScan = false
  while (offset + 4 <= buffer.length) {
    if (buffer[offset++] !== 0xff) invalid()
    while (buffer[offset] === 0xff) offset++
    if (offset + 3 > buffer.length) invalid()
    const marker = buffer[offset++]
    if (marker === 0xda) { hasScan = true; break }
    if (marker === 0xd9 || marker === 0x00) invalid()
    const length = buffer.readUInt16BE(offset)
    if (length < 2 || offset + length > buffer.length) invalid()
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8) invalid()
      dimensions = { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) }
    }
    offset += length
  }
  if (!hasScan || !dimensions || dimensions.width < 32 || dimensions.width !== dimensions.height || dimensions.width > 2048) invalid()
  return dimensions
}

export function photoOwnerTable(owner) {
  if (owner.type === 'patient') return 'patients'
  if (owner.type === 'user') return 'users'
  throw new Error('Invalid photo owner')
}
