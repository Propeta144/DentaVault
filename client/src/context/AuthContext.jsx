import { createContext, useContext, useEffect, useState } from 'react'
import api, { SESSION_ENDED_EVENT } from '../services/api'

const AuthContext = createContext(null)
const TOKEN_KEY = 'dentavault_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // true kapag pinutol ng server ang session (hindi ang user ang nag-sign
  // out): ipinapakita ng LoginPage ang "Your session has ended".
  const [sessionEnded, setSessionEnded] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  // Galing sa api.js: 401 sa isang naka-login na request = hindi na valid
  // ang token sa server (password reset, sign out sa ibang device, atbp.)
  useEffect(() => {
    function handleSessionEnded() {
      clearSession()
      setSessionEnded(true)
    }
    window.addEventListener(SESSION_ENDED_EVENT, handleSessionEnded)
    return () => window.removeEventListener(SESSION_ENDED_EVENT, handleSessionEnded)
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    setSessionEnded(false)
    setUser(data.user)
    return data.user
  }

  // Bagong token ang ibinabalik ng server (wala nang mustChangePassword)
  async function changePassword(currentPassword, newPassword) {
    const { data } = await api.post('/auth/change-password', { currentPassword, newPassword })
    localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data.user
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    // Belt-and-suspenders na lang 'to on top ng per-identity cache-key
    // scoping sa vite.config.js: kapag malinis yung logout, walang
    // matitirang cached patient data ng session na 'to sa service worker's
    // cache para sa susunod na mag-log in sa device na 'to.
    if ('caches' in window) {
      caches.delete('dentavault-api-data').catch(() => {})
      caches.delete('dentavault-xray-images').catch(() => {})
    }
  }

  // Sign out: pinapawalang-bisa rin sa server ang token (hindi lang binubura
  // sa browser). Hindi hinihintay: kahit offline, naka-sign out pa rin dito.
  // Explicit ang header kasi nabubura na ang token bago tumakbo ang
  // request interceptor.
  function logout() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    }
    setSessionEnded(false)
    clearSession()
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionEnded, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
