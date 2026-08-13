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

export default api
