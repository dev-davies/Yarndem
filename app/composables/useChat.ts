export interface Contact {
  id: string
  username: string
  display_name: string
  public_key?: string
  avatar_url?: string | null
}

export interface Conversation {
  id: string
  contact: Contact
  last_message?: {
    id: string
    ciphertext?: string
    preview?: string
    created_at: string
    sender_id: string
  } | null
  unread_count?: number
  updated_at?: string
}

export interface ChatResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export const useChat = () => {
  const { accessToken } = useAuth()

  const conversations = useState<Conversation[]>('chat:conversations', () => [])
  const searchResults = useState<Contact[]>('chat:searchResults', () => [])
  const activeContact = useState<Contact | null>('chat:activeContact', () => null)
  const activePublicKey = useState<string | null>('chat:activePublicKey', () => null)

  const isLoadingConversations = useState<boolean>('chat:loadingConversations', () => false)
  const isSearching = useState<boolean>('chat:isSearching', () => false)
  const isLoadingPublicKey = useState<boolean>('chat:loadingPublicKey', () => false)
  const searchError = useState<string>('chat:searchError', () => '')
  const conversationsError = useState<string>('chat:conversationsError', () => '')

  const extractError = (err: unknown): string => {
    const e = err as { data?: { message?: string; detail?: string; error?: string }; statusCode?: number; status?: number; message?: string }
    const status = e?.statusCode ?? e?.status
    const apiMessage = e?.data?.message || e?.data?.detail || e?.data?.error
    if (apiMessage) return apiMessage
    if (status === 401) return 'Your session has expired. Please log in again.'
    if (status === 403) return 'You do not have permission to perform this action.'
    if (status === 404) return 'Resource not found.'
    if (status === 429) return 'Too many requests. Please slow down.'
    if (status && status >= 500) return 'Server error. Please try again.'
    return e?.message || 'An unexpected error occurred'
  }

  const loadConversations = async (): Promise<ChatResult<Conversation[]>> => {
    if (!accessToken.value) {
      return { success: false, error: 'Not authenticated' }
    }

    isLoadingConversations.value = true
    conversationsError.value = ''
    try {
      const response = await useApi<Conversation[] | { conversations: Conversation[] }>(
        '/conversations',
        { method: 'GET' },
      )

      const list = Array.isArray(response) ? response : response?.conversations ?? []
      conversations.value = list
      return { success: true, data: list }
    } catch (err) {
      const message = extractError(err)
      conversationsError.value = message
      return { success: false, error: message }
    } finally {
      isLoadingConversations.value = false
    }
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  let searchSeq = 0

  const performSearch = async (query: string): Promise<ChatResult<Contact[]>> => {
    if (!accessToken.value) {
      return { success: false, error: 'Not authenticated' }
    }

    const trimmed = query.trim()
    if (!trimmed) {
      searchResults.value = []
      return { success: true, data: [] }
    }

    const seq = ++searchSeq
    isSearching.value = true
    searchError.value = ''
    try {
      const response = await useApi<Contact[] | { users: Contact[] }>(
        '/users/search',
        {
          method: 'GET',
          query: { q: trimmed },
        },
      )

      if (seq !== searchSeq) {
        return { success: true, data: [] }
      }

      const list = Array.isArray(response) ? response : response?.users ?? []
      searchResults.value = list
      return { success: true, data: list }
    } catch (err) {
      const message = extractError(err)
      if (seq === searchSeq) {
        searchResults.value = []
        searchError.value = message
      }
      return { success: false, error: message }
    } finally {
      if (seq === searchSeq) {
        isSearching.value = false
      }
    }
  }

  const searchUsers = (query: string, debounceMs = 250): Promise<ChatResult<Contact[]>> => {
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }

    if (debounceMs <= 0) {
      return performSearch(query)
    }

    return new Promise((resolve) => {
      searchTimer = setTimeout(() => {
        performSearch(query).then(resolve)
      }, debounceMs)
    })
  }

  const clearSearch = () => {
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    searchSeq++
    searchResults.value = []
    searchError.value = ''
    isSearching.value = false
  }

  const setActiveContact = async (user: Contact | null): Promise<void> => {
    activeContact.value = user
    activePublicKey.value = null

    if (!user) {
      isLoadingPublicKey.value = false
      return
    }

    if (user.public_key) {
      activePublicKey.value = user.public_key
      return
    }

    isLoadingPublicKey.value = true
    try {
      const response = await useApi<{ public_key: string } | { user: { public_key: string } }>(
        `/users/${user.id}/public-key`,
        { method: 'GET' },
      )

      const key = (response as { public_key?: string })?.public_key
        ?? (response as { user?: { public_key?: string } })?.user?.public_key
        ?? null

      if (activeContact.value?.id !== user.id) return

      activePublicKey.value = key
      if (key) {
        activeContact.value = { ...user, public_key: key }
      }
    } catch {
      if (activeContact.value?.id === user.id) {
        activePublicKey.value = null
      }
    } finally {
      if (activeContact.value?.id === user.id) {
        isLoadingPublicKey.value = false
      }
    }
  }

  return {
    conversations,
    searchResults,
    activeContact,
    activePublicKey,
    isLoadingConversations,
    isLoadingPublicKey,
    isSearching,
    searchError,
    conversationsError,
    loadConversations,
    searchUsers,
    clearSearch,
    setActiveContact,
  }
}
