export interface UserProfile {
  id: string
  username: string
  display_name: string
  public_key?: string
  wrapped_private_key?: string
  pbkdf2_salt?: string
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
  const needsPasswordToUnlock = useState<boolean>('auth:needsPasswordToUnlock', () => false)
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

  const clearAuth = async () => {
    accessToken.value = null
    refreshToken.value = null
    currentUser.value = null
    needsPasswordToUnlock.value = false
    try {
      const { clearSessionKey } = useCrypto()
      await clearSessionKey()
    } catch {
      /* noop */
    }
  }

  const register = async (
    username: string,
    displayName: string,
    password: string,
  ): Promise<AuthResult> => {
    try {
      const { generateAccountKeys, getActivePrivateKey, getActivePublicKey, storeSessionKey } = useCrypto()
      const { publicKeyBase64, wrappedPrivateKeyBase64, pbkdf2SaltBase64 } =
        await generateAccountKeys(password)

      const response = await useApi<AuthResponse>('/auth/register', {
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

      const privateKey = getActivePrivateKey()
      if (privateKey) {
        await storeSessionKey(privateKey, getActivePublicKey() ?? undefined)
        needsPasswordToUnlock.value = false
      }

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
      const response = await useApi<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { username, password },
      })

      persistAuth(response)

      const { wrapped_private_key, pbkdf2_salt, public_key } = response.user
      if (wrapped_private_key && pbkdf2_salt) {
        try {
          const { unwrapAccountPrivateKey, getActivePrivateKey, getActivePublicKey, storeSessionKey } = useCrypto()
          await unwrapAccountPrivateKey(password, wrapped_private_key, pbkdf2_salt, public_key)
          const privateKey = getActivePrivateKey()
          if (privateKey) {
            await storeSessionKey(privateKey, getActivePublicKey() ?? undefined)
            needsPasswordToUnlock.value = false
          }
        } catch (err) {
          console.error('Failed to unwrap private key after login', err)
          needsPasswordToUnlock.value = true
        }
      } else {
        needsPasswordToUnlock.value = true
      }

      return { success: true, user: response.user }
    } catch (err) {
      return { success: false, error: extractError(err) }
    }
  }

  const unlockWithPassword = async (password: string): Promise<AuthResult> => {
    if (!currentUser.value?.wrapped_private_key || !currentUser.value?.pbkdf2_salt) {
      return { success: false, error: 'Cannot unlock: missing wrapped key on profile.' }
    }
    try {
      const { unwrapAccountPrivateKey, getActivePrivateKey, getActivePublicKey, storeSessionKey } = useCrypto()
      await unwrapAccountPrivateKey(
        password,
        currentUser.value.wrapped_private_key,
        currentUser.value.pbkdf2_salt,
        currentUser.value.public_key,
      )
      const privateKey = getActivePrivateKey()
      if (privateKey) {
        await storeSessionKey(privateKey, getActivePublicKey() ?? undefined)
      }
      needsPasswordToUnlock.value = false
      return { success: true, user: currentUser.value }
    } catch (err) {
      return { success: false, error: extractError(err) || 'Incorrect password.' }
    }
  }

  const logout = async () => {
    try {
      await useApi('/auth/logout', { method: 'POST' })
    } catch (err) {
      console.warn('Server logout failed; continuing with local purge.', err)
    }

    try {
      const { destroyLocalVault } = await import('./useStorage')
      await destroyLocalVault()
    } catch (err) {
      console.error('Failed to destroy local vault', err)
    }

    try {
      const { clearActiveKeys } = useCrypto()
      clearActiveKeys()
    } catch {
      /* noop */
    }

    accessToken.value = null
    refreshToken.value = null
    currentUser.value = null
    needsPasswordToUnlock.value = false

    await navigateTo('/login')
  }

  const fetchMe = async (): Promise<UserProfile | null> => {
    if (!accessToken.value) {
      currentUser.value = null
      needsPasswordToUnlock.value = false
      return null
    }

    try {
      const response = await useApi<UserProfile | { user: UserProfile }>('/auth/me', {
        method: 'GET',
      })

      const profile =
        (response as { user?: UserProfile })?.user
        ?? (response as UserProfile)

      currentUser.value = profile

      try {
        const { retrieveSessionKey, setActivePublicKey, getActivePublicKey } = useCrypto()
        const privateKey = await retrieveSessionKey()
        if (privateKey) {
          if (!getActivePublicKey() && profile.public_key) {
            await setActivePublicKey(profile.public_key)
          }
          needsPasswordToUnlock.value = false
        } else {
          needsPasswordToUnlock.value = true
        }
      } catch (err) {
        console.error('Failed to load session key from vault', err)
        needsPasswordToUnlock.value = true
      }

      return profile
    } catch (err) {
      console.error('Failed to rehydrate session', err)
      return null
    }
  }

  return {
    accessToken,
    refreshToken,
    currentUser,
    isAuthenticated,
    needsPasswordToUnlock,
    register,
    login,
    logout,
    fetchMe,
    unlockWithPassword,
  }
}
