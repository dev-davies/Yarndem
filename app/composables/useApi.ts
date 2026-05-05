import type { NitroFetchOptions } from 'nitropack'

const API_BASE_URL = 'https://whisperbox.koyeb.app'

interface RefreshResponse {
  access_token: string
  refresh_token?: string
}

let refreshInFlight: Promise<string | null> | null = null

const isAuthEndpoint = (path: string): boolean => {
  return /\/auth\/(register|login|refresh)(\b|\/|$)/.test(path)
}

export const useApi = async <T = unknown>(
  request: string,
  options: NitroFetchOptions<string> = {},
): Promise<T> => {
  const accessToken = useCookie<string | null>('access_token')
  const refreshToken = useCookie<string | null>('refresh_token')

  const skipAuth = isAuthEndpoint(request)

  const buildOptions = (token: string | null): NitroFetchOptions<string> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined),
    }
    if (token && !skipAuth && !headers.Authorization) {
      headers.Authorization = `Bearer ${token}`
    }
    return {
      baseURL: API_BASE_URL,
      ...options,
      headers,
    }
  }

  const performRefresh = async (): Promise<string | null> => {
    if (!refreshToken.value) return null

    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        try {
          const response = await $fetch<RefreshResponse>('/auth/refresh', {
            baseURL: API_BASE_URL,
            method: 'POST',
            body: { refresh_token: refreshToken.value },
          })
          accessToken.value = response.access_token
          if (response.refresh_token) {
            refreshToken.value = response.refresh_token
          }
          return response.access_token
        } catch {
          return null
        } finally {
          refreshInFlight = null
        }
      })()
    }

    return refreshInFlight
  }

  const handleAuthFailure = async () => {
    accessToken.value = null
    refreshToken.value = null
    await navigateTo('/login')
  }

  try {
    return await $fetch<T>(request, buildOptions(accessToken.value))
  } catch (err) {
    const status = (err as { statusCode?: number; status?: number })?.statusCode
      ?? (err as { status?: number })?.status

    if (status !== 401 || skipAuth) {
      throw err
    }

    const newToken = await performRefresh()
    if (!newToken) {
      await handleAuthFailure()
      throw err
    }

    try {
      return await $fetch<T>(request, buildOptions(newToken))
    } catch (retryErr) {
      const retryStatus = (retryErr as { statusCode?: number; status?: number })?.statusCode
        ?? (retryErr as { status?: number })?.status
      if (retryStatus === 401) {
        await handleAuthFailure()
      }
      throw retryErr
    }
  }
}
