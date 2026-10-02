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

// Kinukuha ang isang header na idinagdag ni Mailgun sa parsed inbound POST.
// Ipinapadala ito bilang sariling field (hal. "X-Mailgun-Spf") at nasa loob
// din ng `message-headers` (JSON na listahan ng [pangalan, value]). Hindi
// pare-pareho ang capitalization, kaya case-insensitive ang paghahanap.
function mailgunHeader(body, name) {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(body || {})) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value.trim()
  }
  try {
    const headers = typeof body?.['message-headers'] === 'string' ? JSON.parse(body['message-headers']) : null
    const found = Array.isArray(headers) && headers.find((h) => Array.isArray(h) && String(h[0]).toLowerCase() === wanted)
    if (found) return String(found[1]).trim()
  } catch {
    // sirang JSON: ituring na walang header
  }
  return null
}

// Napapatunayan ng verifyMailgunSignature() na galing kay Mailgun ang
// request, pero HINDI na ang pasyente talaga ang nagpadala — madaling
// pekein ang sender address ng email. Kaya tinitingnan din ang SPF result
// na idinadagdag ni Mailgun: "Pass" = pinahintulutan ng domain ng sender
// (hal. gmail.com) ang server na nagpadala.
//
// SPF lang ang batayan, hindi DKIM: ang `sender` field (envelope sender) ang
// itinutugma natin sa patient, at iyon mismo ang sinusuri ng SPF. Ang DKIM
// "Pass" naman ay hindi sinasabi kung KANINONG domain ang pumirma (puwedeng
// sariling domain ng nagpapanggap), kaya itinatala lang ito.
//
// MAILGUN_REQUIRE_SPF=false: para lang sa testing/kung hindi nagpapadala si
// Mailgun ng header. Default true (ligtas): kapag walang result, hindi pasado.
export function senderAuthentication(body) {
  const spf = mailgunHeader(body, 'X-Mailgun-Spf')
  const dkim = mailgunHeader(body, 'X-Mailgun-Dkim-Check-Result')
  const required = String(process.env.MAILGUN_REQUIRE_SPF ?? 'true').toLowerCase() !== 'false'
  const verified = !required || (spf || '').toLowerCase() === 'pass'
  return { spf, dkim, verified }
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
