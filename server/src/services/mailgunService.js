import crypto from 'node:crypto'

// Hindi puwedeng mangailangan ng Bearer token itong webhook na 'to — wala
// namang paraan si Mailgun na magpadala nun — kaya yung signature na mismo
// ang authentication. Kung wala 'tong check, kahit sino sa internet na
// nakahanap ng URL, puwede nang mag-POST ng fake "email" tapos mag-attach
// ng kahit anong images sa record ng kahit sinong patient, basta lang
// mahulaan yung email address na naka-file.
//
// Sini-sign ni Mailgun bawat inbound-route POST sa pamamagitan ng
// HMAC-SHA256 ng (timestamp + token) gamit yung webhook signing key ng
// account — tignan
// https://documentation.mailgun.com/en/latest/user_manual.html#securing-webhooks
export function verifyMailgunSignature({ timestamp, token, signature }) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY
  if (!signingKey || !timestamp || !token || !signature) return false

  const expected = crypto.createHmac('sha256', signingKey).update(timestamp + token).digest('hex')
  const expectedBuf = Buffer.from(expected)
  const signatureBuf = Buffer.from(signature)

  // Nagt-throw yung timingSafeEqual kapag hindi tugma yung lengths, sa
  // halip na mag-return ng false, kaya kailangan ma-catch muna yung
  // malformed/short signature bago pa 'to marating.
  if (expectedBuf.length !== signatureBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, signatureBuf)
}

// Bare address na yung `sender` field ni Mailgun, pero mag-fallback na
// lang sa pag-parse galing sa `From` ("Juan Dela Cruz <juan@example.com>")
// sakaling naiiba ang pagka-configure ng isang route sa inaasahan.
export function extractSenderEmail({ sender, from }) {
  if (sender) return sender.trim().toLowerCase()
  const match = /<([^>]+)>/.exec(from || '')
  if (match) return match[1].trim().toLowerCase()
  return (from || '').trim().toLowerCase()
}
