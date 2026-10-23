import { Check, Circle } from 'lucide-react'
import { PASSWORD_RULES } from '../../utils/passwordPolicy'

// Checklist sa ilalim ng "New password" (#33): nagiging berde ang bawat
// patakaran habang nagta-type, para alam agad ng user (lalo na ng matatandang
// pasyente) kung ano pa ang kulang, bago pa mag-Save.
export default function PasswordChecklist({ id, password, context }) {
  return (
    <ul id={id} className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.ok(password, context)
        return (
          <li key={rule.key} className={`flex items-start gap-1.5 ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
            {ok ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span>
              {rule.label}
              <span className="sr-only">{ok ? ' (done)' : ' (missing)'}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
