import { Clock, LogOut } from 'lucide-react'
import Modal from './Modal'

// Babala bago ang auto sign-out (#33): lumalabas sa huling 60 segundo ng
// 15 minutong walang galaw. X / Escape = manatiling naka-sign in.
export default function IdleWarningModal({ secondsLeft, onStay, onSignOut }) {
  return (
    <Modal title="Are you still there?" onClose={onStay} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-base text-amber-900">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p role="timer" aria-live="polite">
            For your patients&apos; privacy, you&apos;ll be signed out in{' '}
            <span className="font-semibold tabular-nums">{secondsLeft}</span> second{secondsLeft === 1 ? '' : 's'} because
            there has been no activity for a while.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSignOut}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          <button
            type="button"
            onClick={onStay}
            autoFocus
            className="flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-sky-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-sky-700"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </Modal>
  )
}
