// Tinitingnan ang MISMONG laman ng file (unang bytes, "magic number"), hindi
// lang ang Content-Type na sinasabi ng nagpadala. Madaling pekein ang
// Content-Type (hal. HTML o .exe na nagpapanggap na "image/png"), lalo na
// ngayong puwede nang mag-upload ang patient (#27) at dumadaan din ang email
// attachments dito. Ibinabalik ang tunay na MIME type, o null kapag hindi
// JPEG/PNG/WebP/PDF ang laman.
export function detectXrayMimeType(buffer) {
  if (!buffer || buffer.length < 12) return null
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  // WebP: "RIFF" .... "WEBP"
  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'
  // PDF: "%PDF-"
  if (buffer.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf'
  return null
}
