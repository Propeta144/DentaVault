import axios from 'axios'

// Sinadya na relative lang ("/api") yung baseURL — pino-proxy ng
// vite.config.js yung /api requests papunta sa Express server habang
// development, tapos sa production naman, same origin din naman sa API
// yung pinaglilingkuran (o kasabay) ng built client.
const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dentavault_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Kapag 401 ang sagot sa isang naka-login na request (hal. na-reset ang
// password, nag-sign out sa ibang device, o na-delete ang record), hindi na
// valid ang token sa server: sinasabihan ang AuthContext na i-sign out ang
// browser. Hindi kasama ang /auth/login (maling password = 401 din).
export const SESSION_ENDED_EVENT = 'dentavault:session-ended'

api.interceptors.response.use(undefined, (error) => {
  const isLoginRequest = error.config?.url === '/auth/login'
  if (error.response?.status === 401 && !isLoginRequest && localStorage.getItem('dentavault_token')) {
    // `reason` galing sa server (hal. 'signed_in_elsewhere', #39)
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason: error.response.data?.reason } }))
  }
  return Promise.reject(error)
})

export default api
