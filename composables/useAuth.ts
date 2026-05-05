const API_BASE_URL = 'https://whisperbox.koyeb.app'

export interface UserProfile {
  id: string
  username: string
  display_name: string
  public_key?: string
  created_at?: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: UserProfile
}

export interface AuthResult {
  success: boolean
  user?: UserProfile
  error?: string
}

export const useAuth = () => {
  const accessToken = useCookie<string | null>('access_token', {
    default: () => null,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 30,
  })

  const refreshToken = useCookie<string | null>('refresh_token', {
    default: () => null,
    sameSite: 'lax',
    secure: true,
    maxAge: 60 * 60 * 24 * 60,
  })

  const currentUser = useState<UserProfile | null>('auth:currentUser', () => null)
  const isAuthenticated = computed(() => !!accessToken.value && !!currentUser.value)

  const extractError = (err: unknown): string => {
    const e = err as { data?: { message?: string; detail?: string; error?: string }; statusCode?: number; status?: number; message?: string }
    const status = e?.statusCode ?? e?.status
    const apiMessage = e?.data?.message || e?.data?.detail || e?.data?.error

    if (apiMessage) return apiMessage

    if (status === 409) return 'Username taken'
    if (status === 401) return 'Invalid credentials'
    if (status === 400) return 'Invalid request'
    if (status === 429) return 'Too many attempts. Please try again later.'
    if (status && status >= 500) return 'Server error. Please try again.'

    return e?.message || 'An unexpected error occurred'
  }

  const persistAuth = (response: AuthResponse) => {
    accessToken.value = response.access_token
    refreshToken.value = response.refresh_token
    currentUser.value = response.user
  }

  const clearAuth = () => {
    accessToken.value = null
    refreshToken.value = null
    currentUser.value = null
  }

  const register = async (
    username: string,
    displayName: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const { generateAccountKeys } = useCrypto()
      const { publicKeyBase64, wrappedPrivateKeyBase64, pbkdf2SaltBase64 } =
        await generateAccountKeys(password)

      const response = await $fetch<AuthResponse>('/auth/register', {
        baseURL: API_BASE_URL,
        method: 'POST',
        body: {
          username,
          display_name: displayName,
          password,
          public_key: publicKeyBase64,
          wrapped_private_key: wrappedPrivateKeyBase64,
          pbkdf2_salt: pbkdf2SaltBase64,
        },
      })

      persistAuth(response)
      return { success: true, user: response.user }
    } catch (err) {
      return { success: false, error: extractError(err) }
    }
  }

  const login = async (
    username: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const response = await $fetch<AuthResponse>('/auth/login', {
        baseURL: API_BASE_URL,
        method: 'POST',
        body: { username, password },
      })

      persistAuth(response)
      return { success: true, user: response.user }
    } catch (err) {
      return { success: false, error: extractError(err) }
    }
  }

  const logout = () => {
    clearAuth()
  }

  return {
    accessToken,
    refreshToken,
    currentUser,
    isAuthenticated,
    register,
    login,
    logout,
  }
}
