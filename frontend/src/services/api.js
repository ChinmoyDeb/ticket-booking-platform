import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — dynamically attach token to every request
api.interceptors.request.use((config) => {
  const authStorage = localStorage.getItem('tickethub-auth')
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage)
      if (state && state.token) {
        config.headers.Authorization = `Bearer ${state.token}`
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
  return config
})
// Response interceptor — unified error handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear auth and redirect to login
      localStorage.removeItem('tickethub-auth')
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
