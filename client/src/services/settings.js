import api from './api'

export function getSettings() {
  return api.get('/settings').then((r) => r.data)
}
