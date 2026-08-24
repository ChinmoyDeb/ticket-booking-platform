import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { email, password })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
          set({ user: data.user, token: data.token, isLoading: false })
          return data.user
        } catch (err) {
          const msg = err.response?.data?.error || 'Login failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      register: async (email, password, role = 'customer', firstName, lastName) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/register', { email, password, role, firstName, lastName })
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
          set({ user: data.user, token: data.token, isLoading: false })
          return data.user
        } catch (err) {
          const msg = err.response?.data?.error || 'Registration failed'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
      },

      logout: () => {
        delete api.defaults.headers.common['Authorization']
        set({ user: null, token: null, error: null })
      },

      updateProfile: async (updates) => {
        const { data } = await api.put('/auth/me', updates)
        set({ user: data })
        return data
      },

      loadToken: () => {
        const { token } = get()
        if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'tickethub-auth',
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
)

export default useAuthStore
