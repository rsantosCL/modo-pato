import router from '@/router'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

async function doRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}/${path}`, { ...options, headers })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body.detail ?? response.statusText)
  }

  if (response.status === 204) return undefined as T
  return response.json()
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await doRequest<T>(path, options)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && path !== 'v1/auth/refresh/') {
      try {
        const { useAuthStore } = await import('@/stores/auth')
        const auth = useAuthStore()
        await auth.refresh()
        return await doRequest<T>(path, options)
      } catch {
        const { useAuthStore } = await import('@/stores/auth')
        useAuthStore().logout()
        router.push('/login')
        throw e
      }
    }
    throw e
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
