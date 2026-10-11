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
//
// Edad ng timestamp (security review, #26): parehong timestamp/token/signature
// ang dala ng bawat retry ni Mailgun, at hanggang ~8 oras siyang nagre-retry,
// kaya 9 na oras ang pinapayagan (hindi 5 minuto, para hindi mawala ang
// X-ray na nire-retry). Ang pag-uulit ng parehong token ay hinaharang ng
// webhookTokenModel.js.
const MAX_SIGNATURE_AGE_SECONDS = 9 * 60 * 60
const MAX_CLOCK_SKEW_SECONDS = 5 * 60

export function verifyMailgunSignature({ timestamp, token, signature }) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY
  if (!signingKey || !timestamp || !token || !signature) return false
  if (typeof timestamp !== 'string' || typeof token !== 'string' || typeof signature !== 'string') return false

  const age = Math.floor(Date.now() / 1000) - Number(timestamp)
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS || age < -MAX_CLOCK_SKEW_SECONDS) return false

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
//
// LAHAT ng lugar kung saan ito lumalabas ang ibinabalik (security review,
// #26): puwedeng maglagay ang nagpapadala ng sarili niyang pekeng
// "X-Mailgun-Spf: Pass" sa email, kaya hindi puwedeng ang una lang ang
// tingnan. Tignan ang senderAuthentication sa baba.
function mailgunHeaderValues(body, name) {
  const wanted = name.toLowerCase()
  const values = []
  for (const [key, value] of Object.entries(body || {})) {
    if (key.toLowerCase() !== wanted) continue
    for (const v of Array.isArray(value) ? value : [value]) {
      if (typeof v === 'string') values.push(v.trim())
    }
  }
  try {
    const headers = typeof body?.['message-headers'] === 'string' ? JSON.parse(body['message-headers']) : null
    if (Array.isArray(headers)) {
      for (const h of headers) {
        if (Array.isArray(h) && String(h[0]).toLowerCase() === wanted) values.push(String(h[1]).trim())
      }
    }
  } catch {
    // sirang JSON: ituring na walang header
  }
  return values
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
//
// Verified lang kapag "Pass" ang LAHAT ng SPF value na nakita. Kung may
// pekeng "Pass" pero "Fail" ang totoong resulta ni Mailgun, hindi papasa.
// (Kapag parehong "Pass", walang problema — pareho naman ang sinasabi.)
export function senderAuthentication(body) {
  const spfValues = mailgunHeaderValues(body, 'X-Mailgun-Spf')
  const dkimValues = mailgunHeaderValues(body, 'X-Mailgun-Dkim-Check-Result')
  const spf = spfValues.length ? [...new Set(spfValues)].join(', ') : null
  const dkim = dkimValues[0] ?? null
  const required = String(process.env.MAILGUN_REQUIRE_SPF ?? 'true').toLowerCase() !== 'false'
  const spfPass = spfValues.length > 0 && spfValues.every((v) => v.toLowerCase() === 'pass')
  const verified = !required || spfPass
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
