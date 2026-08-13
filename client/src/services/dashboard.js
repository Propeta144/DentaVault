import api from './api'

export function getDashboard() {
  return api.get('/dashboard').then((r) => r.data)
}
