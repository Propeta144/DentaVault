import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import api, { SESSION_ENDED_EVENT } from '../services/api'
import IdleWarningModal from '../components/common/IdleWarningModal'

const AuthContext = createContext(null)
const TOKEN_KEY = 'dentavault_token'
// Huling galaw (click, type, scroll) sa KAHIT ANONG tab ng app (#33):
// localStorage para pare-pareho ang bilang ng lahat ng bukas na tab.
const LAST_ACTIVITY_KEY = 'dentavault_last_activity'
// Galing sa login response: "last sign-in" at kung bakit sapilitang
// papalitan ang password. sessionStorage: nananatili pagka-refresh, nawawala
// pagsara ng tab.
const SIGN_IN_INFO_KEY = 'dentavault_sign_in'
// Bakit pinutol ng server ang session, para sa ibang bukas na tab (#39)
const SIGN_OUT_REASON_KEY = 'dentavault_sign_out_reason'
// Gaano kadalas tinitingnan kung buhay pa ang session (hal. nag-login sa
// ibang device), habang nakabukas at nakikita ang tab.
const SESSION_CHECK_MS = 60 * 1000

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
const IDLE_WARNING_MS = 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove']

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key)) || null
  } catch {
    return null
  }
}

function lastActivity() {
  return Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || 0
}

// Lumampas na sa 15 minuto (may 2s palugit para sa pagitan ng mga tab)
function idleExpired() {
  return lastActivity() > 0 && Date.now() - lastActivity() >= IDLE_TIMEOUT_MS - 2000
}

function touchActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // Bakit nasa login page: 'ended' = pinutol ng server ang session (password
  // reset, sign out sa ibang device...); 'elsewhere' = nag-login ang account
  // sa ibang device (#39); 'idle' = 15 minutong walang galaw.
  // null = ang user mismo ang nag-sign out.
  const [signOutReason, setSignOutReason] = useState(null)
  const [signInInfo, setSignInInfo] = useState(() => readJson(sessionStorage, SIGN_IN_INFO_KEY))
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(null)
  const warningShown = useRef(false)

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(SIGN_IN_INFO_KEY)
    setSignInInfo(null)
    setUser(null)
    setIdleSecondsLeft(null)
    // Belt-and-suspenders na lang 'to on top ng per-identity cache-key
    // scoping sa vite.config.js: kapag malinis yung logout, walang
    // matitirang cached patient data ng session na 'to sa service worker's
    // cache para sa susunod na mag-log in sa device na 'to.
    if ('caches' in window) {
      caches.delete('dentavault-api-data').catch(() => {})
      caches.delete('dentavault-xray-images').catch(() => {})
    }
  }, [])

  // Sign out: pinapawalang-bisa rin sa server ang token (hindi lang binubura
  // sa browser). Hindi hinihintay: kahit offline, naka-sign out pa rin dito.
  // Explicit ang header kasi nabubura na ang token bago tumakbo ang
  // request interceptor (kaya hindi rin nito mati-trigger ang "session ended").
  const logout = useCallback(
    (reason = null) => {
      const token = localStorage.getItem(TOKEN_KEY)
      if (token) {
        api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
      }
      localStorage.removeItem(SIGN_OUT_REASON_KEY)
      setSignOutReason(reason)
      clearSession()
    },
    [clearSession],
  )

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    // Isinara ang browser (o natulog ang laptop) nang lampas 15 minuto:
    // naka-sign out na pagbukas, kahit hindi pa expired ang token.
    if (idleExpired()) {
      logout('idle')
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [logout])

  // Galing sa api.js: 401 sa isang naka-login na request = hindi na valid
  // ang token sa server (password reset, sign out sa ibang device, atbp.)
  useEffect(() => {
    function handleSessionEnded(e) {
      // Kapag sabay na nag-sign out ang ibang tab dahil walang galaw, 401 din
      // ang sagot dito; idle pa rin ang tamang paliwanag.
      let reason = 'ended'
      if (idleExpired()) reason = 'idle'
      else if (e.detail?.reason === 'signed_in_elsewhere') reason = 'elsewhere'
      // Isinusulat bago burahin ang token, para mabasa ng ibang tab
      localStorage.setItem(SIGN_OUT_REASON_KEY, reason)
      clearSession()
      setSignOutReason(reason)
    }
    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded)
  }, [clearSession])

  // Nag-sign out sa ibang tab (kusa o dahil walang galaw): sabay na rito.
  useEffect(() => {
    function handleStorage(e) {
      if (e.key === TOKEN_KEY && !e.newValue && user) {
        setSignOutReason(idleExpired() ? 'idle' : localStorage.getItem(SIGN_OUT_REASON_KEY))
        clearSession()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [user, clearSession])

  // ---- Isang session bawat account (#39) ----
  // Kapag nag-login ang account sa ibang device, nalalaman lang ito ng device
  // na 'to sa susunod na request. Kaya tinitingnan ang /auth/me pagbalik sa
  // tab at bawat minuto habang nakikita ang tab; ang 401 ay sinasalo ng
  // api.js (SESSION_ENDED_EVENT). Maliit na query lang (primary key).
  useEffect(() => {
    if (!user) return undefined
    function checkSession() {
      if (document.visibilityState === 'visible') api.get('/auth/me').catch(() => {})
    }
    const timer = setInterval(checkSession, SESSION_CHECK_MS)
    document.addEventListener('visibilitychange', checkSession)
    window.addEventListener('focus', checkSession)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', checkSession)
      window.removeEventListener('focus', checkSession)
    }
  }, [user])

  // ---- Auto sign-out kapag 15 minutong walang galaw (#33) ----
  // Bawat galaw ay itinatala (hanggang isang beses bawat 5 segundo). Habang
  // nakalabas ang babala, hindi na binibilang ang paggalaw ng mouse: kailangang
  // pindutin ang "Stay signed in", para hindi ito mawala nang hindi nababasa.
  useEffect(() => {
    if (!user) return undefined
    touchActivity()
    let lastWrite = Date.now()
    function onActivity() {
      if (warningShown.current) return
      const now = Date.now()
      if (now - lastWrite > 5000) {
        lastWrite = now
        touchActivity()
      }
    }
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }))
    const timer = setInterval(() => {
      const left = IDLE_TIMEOUT_MS - (Date.now() - lastActivity())
      if (left <= 0) {
        warningShown.current = false
        logout('idle')
      } else if (left <= IDLE_WARNING_MS) {
        warningShown.current = true
        setIdleSecondsLeft(Math.ceil(left / 1000))
      } else if (warningShown.current) {
        // Pinindot ang "Stay signed in" sa ibang tab
        warningShown.current = false
        setIdleSecondsLeft(null)
      }
    }, 1000)
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }))
      clearInterval(timer)
    }
  }, [user, logout])

  function staySignedIn() {
    touchActivity()
    warningShown.current = false
    setIdleSecondsLeft(null)
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    touchActivity()
    const info = { ...data.signIn, passwordUpgradeRequired: Boolean(data.user.passwordUpgradeRequired) }
    sessionStorage.setItem(SIGN_IN_INFO_KEY, JSON.stringify(info))
    localStorage.removeItem(SIGN_OUT_REASON_KEY)
    setSignInInfo(info)
    setSignOutReason(null)
    setUser(data.user)
    return data.user
  }

  // Bagong token ang ibinabalik ng server (wala nang mustChangePassword)
  async function changePassword(currentPassword, newPassword) {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword })
    localStorage.setItem(TOKEN_KEY, data.token)
    if (signInInfo?.passwordUpgradeRequired) {
      const info = { ...signInInfo, passwordUpgradeRequired: false }
      sessionStorage.setItem(SIGN_IN_INFO_KEY, JSON.stringify(info))
      setSignInInfo(info)
    }
    setUser(data.user)
    return data.user
  }

  // "Last sign-in" banner: isang beses lang ipinapakita bawat login
  function dismissSignInNotice() {
    const info = { ...signInInfo, noticeDismissed: true }
    sessionStorage.setItem(SIGN_IN_INFO_KEY, JSON.stringify(info))
    setSignInInfo(info)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signOutReason,
        signInInfo,
        login,
        logout: () => logout(null),
        changePassword,
        dismissSignInNotice,
      }}
    >
      {children}
      {user && idleSecondsLeft !== null && (
        <IdleWarningModal secondsLeft={idleSecondsLeft} onStay={staySignedIn} onSignOut={() => logout(null)} />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
