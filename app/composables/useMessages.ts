const WS_BASE_URL = 'wss://whisperbox.koyeb.app/ws'

export interface DecryptedMessage {
  id: string
  conversationId?: string
  senderId: string
  recipientId: string
  text: string
  createdAt: string
  sentBySelf: boolean
  status?: 'sent' | 'delivered' | 'read' | 'failed'
}

interface ServerEncryptedPayload {
  ciphertext: string
  iv: string
  encryptedKey: string
  encryptedKeyForSelf: string
}

interface EncryptedMessageEnvelope {
  id: string
  from_user_id: string
  to_user_id: string
  payload: ServerEncryptedPayload
  delivered?: boolean
  created_at: string
}

interface WSFrame<T = unknown> {
  type: string
  payload?: T
  data?: T
}

interface ContactPresence {
  online: boolean
  lastSeen?: string
}

type PresencePayload =
  | {
      user_id?: string
      userId?: string
      id?: string
      sender_id?: string
      user?: PresencePayload
      contact?: PresencePayload
      online?: boolean
      is_online?: boolean
      isOnline?: boolean
      status?: string
      last_seen?: string
      lastSeen?: string
      users?: PresencePayload[]
      online_users?: PresencePayload[]
      offline_users?: PresencePayload[]
      online_user_ids?: string[]
      offline_user_ids?: string[]
    }
  | string
  | PresencePayload[]
  | undefined

export const useMessages = () => {
  const accessToken = useCookie<string | null>('access_token')
  const { encryptMessage, decryptMessage, getActivePublicKey, setActivePublicKey } = useCrypto()
  const { currentUser } = useAuth()
  const { saveLocalMessage, getLocalMessages, getRecentContacts } = useStorage()
  const { conversations, activeContact, upsertConversation } = useChat()

  const getMyId = (): string | null => currentUser.value?.id ?? null

  const conversationKey = (otherUserId: string, myId?: string | null): string => {
    const me = myId ?? getMyId()
    if (!me) return 'unknown:' + otherUserId
    return [me, otherUserId].sort().join(':')
  }

  const messages = useState<DecryptedMessage[]>('messages:list', () => [])
  const ws = useState<WebSocket | null>('messages:ws', () => null)
  const isConnected = useState<boolean>('messages:wsConnected', () => false)
  const activeConversationUserId = useState<string | null>('messages:activeUser', () => null)
  const isContactTyping = useState<boolean>('messages:isContactTyping', () => false)
  const contactPresence = useState<Record<string, ContactPresence>>('messages:contactPresence', () => ({}))

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let manuallyClosed = false
  let typingTimeout: ReturnType<typeof setTimeout> | null = null
  let lastTypingSentAt = 0

  const isMine = (senderId: string): boolean => {
    return !!currentUser.value && currentUser.value.id === senderId
  }

  const setContactPresence = (userId: string, online: boolean, lastSeen?: string): void => {
    if (!userId || userId === getMyId()) return
    contactPresence.value = {
      ...contactPresence.value,
      [userId]: {
        online,
        lastSeen: lastSeen || contactPresence.value[userId]?.lastSeen,
      },
    }
  }

  const normalizePresence = (payload: PresencePayload, frameType: string): boolean => {
    if (!payload) return false

    if (typeof payload === 'string') {
      setContactPresence(payload, frameType.includes('online') && !frameType.includes('offline'))
      return true
    }

    if (Array.isArray(payload)) {
      payload.forEach((item) => normalizePresence(item, frameType))
      return true
    }

    let handled = false

    if (Array.isArray(payload.online_user_ids)) {
      payload.online_user_ids.forEach((id) => setContactPresence(id, true))
      handled = true
    }
    if (Array.isArray(payload.offline_user_ids)) {
      payload.offline_user_ids.forEach((id) => setContactPresence(id, false, new Date().toISOString()))
      handled = true
    }
    if (Array.isArray(payload.users)) {
      payload.users.forEach((user) => normalizePresence(user, frameType))
      handled = true
    }
    if (Array.isArray(payload.online_users)) {
      payload.online_users.forEach((user) => normalizePresence(user, 'online'))
      handled = true
    }
    if (Array.isArray(payload.offline_users)) {
      payload.offline_users.forEach((user) => normalizePresence(user, 'offline'))
      handled = true
    }
    if (payload.user) {
      handled = normalizePresence(payload.user, frameType) || handled
    }
    if (payload.contact) {
      handled = normalizePresence(payload.contact, frameType) || handled
    }

    const userId = payload.user_id || payload.userId || payload.id || payload.sender_id
    if (!userId) {
      return handled
    }

    const status = payload.status?.toLowerCase()
    const online = typeof payload.online === 'boolean'
      ? payload.online
      : typeof payload.is_online === 'boolean'
        ? payload.is_online
        : typeof payload.isOnline === 'boolean'
          ? payload.isOnline
          : frameType.includes('offline')
            ? false
            : frameType.includes('online')
              ? true
              : status === 'online'

    if (status === 'online' || status === 'offline' || typeof payload.online === 'boolean' || typeof payload.is_online === 'boolean' || typeof payload.isOnline === 'boolean' || frameType.includes('online') || frameType.includes('offline')) {
      setContactPresence(userId, online, payload.last_seen || payload.lastSeen)
      return true
    }

    return handled
  }

  const toEncryptedPayload = (envelope: EncryptedMessageEnvelope): EncryptedMessagePayload => ({
    ciphertext: envelope.payload?.ciphertext || '',
    iv: envelope.payload?.iv || '',
    encryptedKey: envelope.payload?.encryptedKey || '',
    encryptedKeyForSelf: envelope.payload?.encryptedKeyForSelf || '',
  })

  const decryptEnvelope = async (
    envelope: EncryptedMessageEnvelope,
  ): Promise<DecryptedMessage> => {
    const sentBySelf = isMine(envelope.from_user_id)
    let text: string
    try {
      text = await decryptMessage(toEncryptedPayload(envelope), sentBySelf, envelope.id)
    } catch (err) {
      console.error(`[useMessages] Decryption failure for message ${envelope.id}:`, err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      text = `[Unable to decrypt message: ${errorMsg}]`
    }

    return {
      id: envelope.id,
      senderId: envelope.from_user_id,
      recipientId: envelope.to_user_id,
      text,
      createdAt: envelope.created_at,
      sentBySelf,
      status: envelope.delivered ? 'delivered' : 'sent',
    }
  }

  const connectWS = async (): Promise<WebSocket | null> => {
    if (typeof window === 'undefined') return null
    if (!accessToken.value) {
      console.warn('Cannot open WebSocket: no access token.')
      return null
    }
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return ws.value
    }

    const { getActivePrivateKey, retrieveSessionKey, setActivePublicKey, getActivePublicKey } = useCrypto()
    if (!getActivePrivateKey()) {
      try {
        await retrieveSessionKey()
      } catch (err) {
        console.warn('Failed to rehydrate session key before WS connect', err)
      }
    }
    if (!getActivePublicKey() && currentUser.value?.public_key) {
      try {
        await setActivePublicKey(currentUser.value.public_key)
      } catch (err) {
        console.warn('Failed to import own public key before WS connect', err)
      }
    }

    manuallyClosed = false
    const socket = new WebSocket(`${WS_BASE_URL}?token=${encodeURIComponent(accessToken.value)}`)
    ws.value = socket

    socket.onopen = () => {
      isConnected.value = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    socket.onmessage = async (event: MessageEvent) => {
      let frame: WSFrame
      try {
        frame = JSON.parse(event.data)
      } catch (err) {
        console.error('Invalid WS frame', err)
        return
      }

      if (frame.type === 'typing') {
        const payload = (frame.payload || frame.data) as { sender_id?: string } | undefined
        const senderId = payload?.sender_id
        if (senderId) {
          setContactPresence(senderId, true)
        }
        const activeId = activeConversationUserId.value
        if (!senderId || !activeId || senderId !== activeId) return

        isContactTyping.value = true
        if (typingTimeout) clearTimeout(typingTimeout)
        typingTimeout = setTimeout(() => {
          isContactTyping.value = false
          typingTimeout = null
        }, 3000)
        return
      }

      if (frame.type === 'read') {
        const payload = (frame.payload || frame.data) as
          | { message_id?: string; reader_id?: string }
          | undefined
        const messageId = payload?.message_id
        if (!messageId) return

        const idx = messages.value.findIndex((m) => m.id === messageId)
        if (idx === -1) return
        const next = [...messages.value]
        next[idx] = { ...next[idx], status: 'read' } as DecryptedMessage
        messages.value = next
        return
      }

      if (frame.type.startsWith('presence') || frame.type.startsWith('user.') || frame.type === 'online' || frame.type === 'offline') {
        if (normalizePresence((frame.payload || frame.data) as PresencePayload, frame.type)) {
          return
        }
      }

      if (frame.type === 'message.receive' || frame.type === 'message') {
        const envelope = (frame.payload || frame.data) as EncryptedMessageEnvelope | undefined
        if (!envelope || !envelope.payload) {
          console.warn('[useMessages] Received frame without payload', frame)
          return
        }

        const myId = currentUser.value?.id
        const otherUserId = envelope.from_user_id === myId ? envelope.to_user_id : envelope.from_user_id
        setContactPresence(otherUserId, true)
        const decrypted = await decryptEnvelope(envelope)
        const activeId = activeConversationUserId.value
        const involvesActive =
          !!activeId &&
          (envelope.from_user_id === activeId || envelope.to_user_id === activeId)
        const isIncomingForInactiveChat = !decrypted.sentBySelf && !involvesActive

        try {
          await saveLocalMessage(conversationKey(otherUserId, myId), decrypted as never)
        } catch (err) {
          console.error('Failed to archive incoming message', err)
        }

        const existingConvo = conversations.value.find((c) => c.contact?.id === otherUserId || c.id === otherUserId)
        let contact = existingConvo?.contact || {
          id: otherUserId,
          username: otherUserId,
          display_name: otherUserId,
        }

        if (!contact.public_key) {
          try {
            const response = await useApi<{ public_key: string }>(
              `/users/${otherUserId}/public-key`,
              { method: 'GET' },
            )
            contact = {
              ...contact,
              public_key: response.public_key,
            }
          } catch (err) {
            console.warn(`[useMessages] Failed to fetch public key for unknown sender ${otherUserId}`, err)
          }
        }

        upsertConversation(contact, {
          lastMessage: {
            id: decrypted.id,
            preview: decrypted.text,
            created_at: decrypted.createdAt,
            sender_id: decrypted.senderId,
          },
          unreadIncrement: isIncomingForInactiveChat ? 1 : 0,
        })

        if (!involvesActive) return

        if (messages.value.some((m) => m.id === decrypted.id)) return
        messages.value = [...messages.value, decrypted]
      }
    }

    socket.onclose = () => {
      isConnected.value = false
      ws.value = null
      if (!manuallyClosed && accessToken.value) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => connectWS(), 2000)
      }
    }

    socket.onerror = (err) => {
      console.error('WebSocket error', err)
    }

    return socket
  }

  const disconnectWS = () => {
    manuallyClosed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }
    isConnected.value = false
    contactPresence.value = {}
  }

  const loadHistory = async (userId: string): Promise<DecryptedMessage[]> => {
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }

    activeConversationUserId.value = userId
    const convoKey = conversationKey(userId, getMyId())

    const cached = await getLocalMessages(convoKey)
    if (cached.length > 0) {
      messages.value = cached as DecryptedMessage[]
    } else {
      messages.value = []
    }

    const cachedIds = new Set(cached.map((m) => m.id))

    try {
      const response = await useApi<EncryptedMessageEnvelope[] | { messages: EncryptedMessageEnvelope[] }>(
        `/conversations/${userId}/messages`,
        { method: 'GET' },
      )

      const list = Array.isArray(response) ? response : response?.messages ?? []
      const fresh = list.filter((env) => !cachedIds.has(env.id))
      if (fresh.length === 0) {
        return messages.value
      }

      const decrypted = await Promise.all(fresh.map((env) => decryptEnvelope(env)))

      await Promise.all(
        decrypted.map((m) => saveLocalMessage(convoKey, m as never)),
      )

      const merged = [...messages.value, ...decrypted]
        .filter((m, idx, arr) => arr.findIndex((x) => x.id === m.id) === idx)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      messages.value = merged
      return merged
    } catch (err) {
      console.error('Failed to fetch fresh history', err)
      return messages.value
    }
  }

  const clearMessages = () => {
    messages.value = []
    activeConversationUserId.value = null
    isContactTyping.value = false
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      typingTimeout = null
    }
  }

  const sendTypingEvent = (toUserId: string): void => {
    const socket = ws.value
    if (!socket || socket.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    if (now - lastTypingSentAt < 2000) return
    lastTypingSentAt = now

    try {
      socket.send(
        JSON.stringify({
          type: 'typing',
          payload: { recipient_id: toUserId },
        }),
      )
    } catch (err) {
      console.warn('Failed to send typing event', err)
    }
  }

  const sendReadReceipt = (messageId: string, senderId: string): void => {
    const socket = ws.value
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    if (!messageId || !senderId) return

    try {
      socket.send(
        JSON.stringify({
          type: 'read',
          payload: { message_id: messageId, sender_id: senderId },
        }),
      )
    } catch (err) {
      console.warn('Failed to send read receipt', err)
    }
  }

  const loadSidebar = async (): Promise<void> => {
    const contactIds = await getRecentContacts()
    if (contactIds.length === 0) return

    for (const id of contactIds) {
      try {
        const response = await useApi<{ public_key: string }>(
          `/users/${id}/public-key`,
          { method: 'GET' },
        )
        
        const existing = conversations.value.find((c) => (c.contact?.id === id || c.id === id))
        if (existing) {
          conversations.value = conversations.value.map((c) =>
            (c.contact?.id === id || c.id === id)
              ? { ...c, contact: { ...c.contact, public_key: response.public_key }, updated_at: new Date().toISOString() }
              : c
          )
        } else {
          conversations.value = [
            {
              id: `conv-${id}`,
              contact: {
                id,
                username: id,
                display_name: id,
                public_key: response.public_key,
              },
              updated_at: new Date().toISOString(),
            },
            ...conversations.value,
          ]
        }
      } catch (err) {
        console.warn(`[useMessages] Failed to rehydrate public key for ${id}`, err)
        const existing = conversations.value.find((c) => c.contact.id === id)
        if (!existing) {
          conversations.value = [
            {
              id: `conv-${id}`,
              contact: {
                id,
                username: id,
                display_name: id,
              },
              updated_at: new Date().toISOString(),
            },
            ...conversations.value,
          ]
        }
      }
    }
  }

  const sendMessage = async (
    toUserId: string,
    plaintext: string,
    recipientPublicKey: string,
  ): Promise<DecryptedMessage> => {
    const trimmed = plaintext.trim()
    if (!trimmed) {
      throw new Error('Cannot send an empty message.')
    }
    if (!accessToken.value) {
      throw new Error('Not authenticated')
    }

    if (!getActivePublicKey() && currentUser.value?.public_key) {
      try {
        await setActivePublicKey(currentUser.value.public_key)
      } catch (err) {
        console.warn('Failed to import own public key from profile', err)
      }
    }

    const payload = await encryptMessage(trimmed, recipientPublicKey)

    const wireBody = {
      to: toUserId,
      payload: {
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        encryptedKey: payload.encryptedKey,
        encryptedKeyForSelf: payload.encryptedKeyForSelf,
      },
    }

    const convoKey = conversationKey(toUserId, getMyId())
    const optimistic: DecryptedMessage = {
      id: `local-${Date.now()}`,
      senderId: currentUser.value?.id || 'me',
      recipientId: toUserId,
      text: trimmed,
      createdAt: new Date().toISOString(),
      sentBySelf: true,
      status: 'sent',
    }
    messages.value = [...messages.value, optimistic]

    try {
      const saved = await useApi<EncryptedMessageEnvelope>('/messages', {
        method: 'POST',
        body: wireBody,
      })

      const idx = messages.value.findIndex((m) => m.id === optimistic.id)
      let finalMessage: DecryptedMessage = optimistic
      if (idx !== -1) {
        finalMessage = {
          ...optimistic,
          id: saved.id,
          createdAt: saved.created_at,
          status: saved.delivered ? 'delivered' : 'sent',
        }
        const next = [...messages.value]
        next[idx] = finalMessage
        messages.value = next
      }
      await saveLocalMessage(convoKey, finalMessage as never)
      if (activeContact.value) {
        upsertConversation(activeContact.value, {
          lastMessage: {
            id: finalMessage.id,
            preview: finalMessage.text,
            created_at: finalMessage.createdAt,
            sender_id: finalMessage.senderId,
          },
        })
      }
      return finalMessage
    } catch (err) {
      const idx = messages.value.findIndex((m) => m.id === optimistic.id)
      if (idx !== -1) {
        const next = [...messages.value]
        next[idx] = { ...optimistic, status: 'failed' }
        messages.value = next
      }
      throw err
    }
  }

  return {
    messages,
    ws,
    isConnected,
    contactPresence,
    activeConversationUserId,
    isContactTyping,
    connectWS,
    disconnectWS,
    loadHistory,
    clearMessages,
    sendMessage,
    sendTypingEvent,
    sendReadReceipt,
    loadSidebar,
  }
}
