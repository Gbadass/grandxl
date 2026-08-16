import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { setClient } from '@grandxl/api-client'
import { useAuthStore } from '../store/auth.store'

const SECURE_KEY_ACCESS = 'grandxl_access_token'
const SECURE_KEY_REFRESH = 'grandxl_refresh_token'
const SECURE_KEY_LAST_MODE = 'grandxl_last_mode'

export { SECURE_KEY_ACCESS, SECURE_KEY_REFRESH, SECURE_KEY_LAST_MODE }

const instance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(SECURE_KEY_ACCESS)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false

instance.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !original._retry && !isRefreshing) {
      original._retry = true
      isRefreshing = true

      try {
        const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH)
        if (!refreshToken) throw new Error('No refresh token')

        const res = await axios.post<{
          data: { accessToken: string; refreshToken?: string; user: import('@grandxl/types').User }
        }>(`${process.env.EXPO_PUBLIC_API_URL}/auth/refresh/mobile`, { refreshToken }, {
          headers: { 'Content-Type': 'application/json' },
        })

        const { accessToken, refreshToken: newRefreshToken, user } = res.data.data
        await SecureStore.setItemAsync(SECURE_KEY_ACCESS, accessToken)
        if (newRefreshToken) await SecureStore.setItemAsync(SECURE_KEY_REFRESH, newRefreshToken)
        useAuthStore.getState().setAuth(user, accessToken)

        original.headers.Authorization = `Bearer ${accessToken}`
        return instance(original)
      } catch (err) {
        await SecureStore.deleteItemAsync(SECURE_KEY_ACCESS)
        await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH)
        useAuthStore.getState().clearAuth()
        return Promise.reject(err)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

setClient(instance)
export default instance
