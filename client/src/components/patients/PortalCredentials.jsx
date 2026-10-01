import { useId, useState } from 'react'
import { Copy, Check, Printer, RefreshCw } from 'lucide-react'
import logoUrl from '../../assets/brand/teodosio-rufin-logo.png'
import { generatePassword } from '../../utils/generatePassword'

// Shared ng CreatePortalAccountModal at ResetPortalPasswordModal (dati
// magkaparehong code sa dalawang file).

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// "Print slip" — maliit na papel na maibibigay sa pasyente (mas maayos kaysa
// isulat sa kung saan). Sariling window na may simpleng HTML; escaped ang
// lahat ng value.
function printCredentialsSlip({ fullName, email, password }) {
  const win = window.open('', '_blank', 'width=480,height=640')
  if (!win) return false
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>DentaVault login</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#171123;margin:32px}img{height:56px}
h1{font-size:18px;margin:24px 0 4px}p{margin:4px 0;font-size:14px}.box{border:1px dashed #a299b2;border-radius:8px;padding:16px;margin:16px 0;font-family:ui-monospace,Consolas,monospace;font-size:16px}
.muted{color:#5d5170}</style></head><body>
<img src="${escapeHtml(new URL(logoUrl, window.location.origin).href)}" alt="Teodosio-Rufin Dental Clinic">
<h1>Your DentaVault patient portal login</h1>
<p class="muted">For ${escapeHtml(fullName)}</p>
<div class="box"><p>Website: ${escapeHtml(window.location.origin)}</p><p>Email: ${escapeHtml(email)}</p><p>Temporary password: ${escapeHtml(password)}</p></div>
<p>You will be asked to set your own password the first time you sign in.</p>
<p class="muted">Keep this slip private. Ask the clinic if you need a new password.</p>
<script>window.onload=function(){window.print()}</script></body></html>`)
  win.document.close()
  return true
}

// Ipinapakita pagkatapos gumawa/mag-reset: ang credentials, Copy, Print, Done
export function PortalCredentials({ fullName, email, password, onDone }) {
  const [copyState, setCopyState] = useState('idle') // idle | copied | failed

  async function handleCopy() {
    try {
      // Dati hindi chine-check ang resulta, kaya "Copied" pa rin kahit pumalya
      // (hal. walang clipboard permission)
      await navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    setTimeout(() => setCopyState('idle'), 2500)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-base">
        <div className="break-all">
          <span className="text-slate-500">Email: </span>
          {email}
        </div>
        <div>
          <span className="text-slate-500">Password: </span>
          {password}
        </div>
      </div>
      <p className="text-sm text-slate-500">
        The patient will be asked to set their own password the first time they sign in.
      </p>
      {copyState === 'failed' && (
        <p role="alert" className="text-sm text-red-600">
          Couldn&apos;t copy automatically. Select the text above and copy it, or print the slip.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {copyState === 'copied' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copyState === 'copied' ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={() => printCredentialsSlip({ fullName, email, password })}
          className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          Print slip
        </button>
        <button
          type="button"
          onClick={onDone}
          className="col-span-2 min-h-11 rounded-md bg-sky-600 px-4 text-base font-semibold text-white transition-colors hover:bg-sky-700"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// Temporary password input + "generate" button. Sariling validation (min 8,
// max 72 = bcrypt limit), naka-link ang label.
export function TemporaryPasswordField({ label, value, onChange, error }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-base font-medium text-slate-700">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={72}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-help`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-md border px-3 py-2.5 font-mono text-base text-slate-900 focus:outline-none focus:ring-2 ${
            error ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 focus:border-sky-500 focus:ring-sky-100'
          }`}
        />
        <button
          type="button"
          onClick={() => onChange(generatePassword())}
          aria-label="Generate a new password"
          title="Generate a new password"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <p id={`${id}-help`} className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-slate-500'}`}>
        {error || 'At least 8 characters. Generated passwords avoid look-alike letters (I, l, O, 0).'}
      </p>
    </div>
  )
}
