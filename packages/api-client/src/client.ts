import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

let _client: AxiosInstance | null = null

interface InitOptions {
  baseURL: string
  withCredentials?: boolean
  timeout?: number
}

export function initApiClient(options: InitOptions): void {
  _client = axios.create({
    baseURL: options.baseURL,
    withCredentials: options.withCredentials ?? true,
    timeout: options.timeout ?? 15000,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function getClient(): AxiosInstance {
  if (!_client) {
    throw new Error(
      'API client not initialized. Call initApiClient({ baseURL }) before making any API calls.',
    )
  }
  return _client
}

// Allows apps to inject their own pre-configured axios instance
// (web uses its own instance with silent refresh interceptors)
export function setClient(instance: AxiosInstance): void {
  _client = instance
}

export type { AxiosRequestConfig }
