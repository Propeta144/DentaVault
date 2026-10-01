import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
const TOKEN_KEY = 'dentavault_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
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

  function logout() {
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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
